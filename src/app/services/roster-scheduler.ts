import { Injectable } from '@angular/core';
import { MONTHS } from '../constants';
import { Assignment, RosterConfig, ShiftType, StaffMember, isHaStaff, pad2 } from '../models/types';

export type ShiftKind = 'Morning' | 'Evening' | 'Night';
export type StaffCategory = 'Regular' | 'HA';

export interface ShiftShortfall {
  date: string;
  day: number;
  shift: ShiftKind;
  category: StaffCategory;
  required: number;
  filled: number;
}

export interface SeniorGap {
  date: string;
  day: number;
  shift: ShiftKind;
  required: number;
  filled: number;
}

export interface SchedulerReport {
  assignmentsCreated: number;
  dutiesAssigned: number;
  daysInMonth: number;
  shortfalls: ShiftShortfall[];
  seniorGaps: SeniorGap[];
  anchorsPreserved: number;
}

export interface SchedulerResult {
  assignments: Assignment[];
  report: SchedulerReport;
}

const MORNING_CODES = new Set<ShiftType>([
  ShiftType.Morning,
  ShiftType.RequestedMorning,
  ShiftType.MorningSpecial,
  ShiftType.MorningOnCall,
]);
const EVENING_CODES = new Set<ShiftType>([
  ShiftType.Evening,
  ShiftType.RequestedEvening,
  ShiftType.EveningOnCall,
]);
const NIGHT_CODES = new Set<ShiftType>([ShiftType.Night, ShiftType.RequestedNight, ShiftType.NightOnCall]);

/** Any code that counts as a worked day for consecutive-duty purposes. */
const DUTY_CODES = new Set<ShiftType>([...MORNING_CODES, ...EVENING_CODES, ...NIGHT_CODES]);

/** How far back to look before day 1 so month boundaries respect recovery rules. */
const WARMUP_DAYS = 7;

/** Effective per-category limits resolved from the config. */
interface Limits {
  minMorning: number;
  minEvening: number;
  minNight: number;
  minMorningWeekend: number;
  minEveningWeekend: number;
  minNightWeekend: number;
  minMorningHoliday: number;
  minEveningHoliday: number;
  minNightHoliday: number;
  minSenior: number;
  maxMale: number;
  maxConsecutiveDuty: number;
  maxConsecutiveEvening: number;
  maxConsecutiveNight: number;
  offAfterNight: number;
  /** Seniority and gender balance do not apply to HA staff. */
  applyBalanceRules: boolean;
}

interface StaffState {
  member: StaffMember;
  index: number;
  /** Day number -> shift. Day 1..N is the roster month; <= 0 is the warm-up tail. */
  byDay: Map<number, ShiftType>;
  /** Day numbers carrying an immovable anchored duty, used for look-ahead. */
  anchorDutyDays: Map<number, ShiftType>;
  counts: { morning: number; evening: number; night: number };
  totalDuties: number;
  consecutiveDuty: number;
  eveningRun: number;
  nightRun: number;
  lastNightDay: number;
  capacity: number;
}

/**
 * Deterministic, offline duty-roster generator.
 *
 * Walks the month day by day and fills each shift up to its minimum headcount with the
 * least-loaded eligible staff member, honouring recovery periods, consecutive-duty caps,
 * per-person monthly limits, and (for regular staff) seniority and gender balance.
 * Every pre-existing assignment is treated as an immovable anchor.
 *
 * Where a rule cannot be satisfied it leaves the slot empty and records a shortfall
 * rather than silently violating the constraint.
 */
@Injectable({ providedIn: 'root' })
export class RosterScheduler {
  generateRoster(staff: StaffMember[], config: RosterConfig, manualAssignments: Assignment[]): SchedulerResult {
    const monthIdx = Math.max(0, MONTHS.indexOf(config.month));
    const daysInMonth = new Date(config.year, monthIdx + 1, 0).getDate();

    const rosterStaff = staff.filter((s) => !s.isCounterPart);
    const regular = rosterStaff.filter((s) => !isHaStaff(s.name));
    const ha = rosterStaff.filter((s) => isHaStaff(s.name));

    const report: SchedulerReport = {
      assignmentsCreated: 0,
      dutiesAssigned: 0,
      daysInMonth,
      shortfalls: [],
      seniorGaps: [],
      anchorsPreserved: 0,
    };

    const assignments: Assignment[] = [
      ...this.scheduleGroup(regular, config, manualAssignments, monthIdx, daysInMonth, 'Regular', report),
      ...this.scheduleGroup(ha, config, manualAssignments, monthIdx, daysInMonth, 'HA', report),
    ];

    report.assignmentsCreated = assignments.length;
    report.dutiesAssigned = assignments.filter((a) => DUTY_CODES.has(a.shift)).length;

    return { assignments, report };
  }

  private resolveLimits(config: RosterConfig, category: StaffCategory): Limits {
    const isHA = category === 'HA';
    const pick = (haValue: number | undefined, value: number) => (isHA ? (haValue ?? value) : value);

    const minMorningHoliday = config.minMorningHoliday ?? config.minMorning;
    const minEveningHoliday = config.minEveningHoliday ?? config.minEvening;
    const minNightHoliday = config.minNightHoliday ?? config.minNight;

    return {
      minMorning: pick(config.haMinMorning, config.minMorning),
      minEvening: pick(config.haMinEvening, config.minEvening),
      minNight: pick(config.haMinNight, config.minNight),
      minMorningWeekend: pick(config.haMinMorningWeekend, config.minMorningWeekend ?? config.minMorning),
      minEveningWeekend: pick(config.haMinEveningWeekend, config.minEveningWeekend ?? config.minEvening),
      minNightWeekend: pick(config.haMinNightWeekend, config.minNightWeekend ?? config.minNight),
      minMorningHoliday: pick(config.haMinMorningHoliday, minMorningHoliday),
      minEveningHoliday: pick(config.haMinEveningHoliday, minEveningHoliday),
      minNightHoliday: pick(config.haMinNightHoliday, minNightHoliday),
      minSenior: pick(config.haMinSenior, config.minSenior),
      maxMale: pick(config.haMaxMale, config.maxMale),
      maxConsecutiveDuty: pick(config.haMaxConsecutiveDuty, config.maxConsecutiveDuty),
      maxConsecutiveEvening: config.maxConsecutiveEvening,
      maxConsecutiveNight: config.maxConsecutiveNight,
      offAfterNight: pick(config.haOffAfterNight, config.offAfterNight),
      applyBalanceRules: !isHA,
    };
  }

  private dateStr(year: number, monthIdx: number, day: number): string {
    const d = new Date(year, monthIdx, day);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  private scheduleGroup(
    group: StaffMember[],
    config: RosterConfig,
    manualAssignments: Assignment[],
    monthIdx: number,
    daysInMonth: number,
    category: StaffCategory,
    report: SchedulerReport,
  ): Assignment[] {
    if (group.length === 0) return [];

    const limits = this.resolveLimits(config, category);
    const holidays = new Set(config.holidays ?? []);
    const groupIds = new Set(group.map((s) => s.id));

    // Anchors: every existing assignment for this group, keyed by "staffId|date".
    const anchors = new Map<string, ShiftType>();
    for (const a of manualAssignments) {
      if (groupIds.has(a.staffId)) anchors.set(`${a.staffId}|${a.date}`, a.shift);
    }

    const states: StaffState[] = group.map((member, index) => ({
      member,
      index,
      byDay: new Map<number, ShiftType>(),
      anchorDutyDays: this.anchorDutyDays(member, anchors, config, monthIdx, daysInMonth),
      counts: { morning: 0, evening: 0, night: 0 },
      totalDuties: 0,
      consecutiveDuty: 0,
      eveningRun: 0,
      nightRun: 0,
      lastNightDay: -999,
      capacity: Math.max(1, member.maxMorning + member.maxEvening + member.maxNight),
    }));

    // Warm-up: replay the tail of the previous month so recovery periods carry over.
    for (let day = -WARMUP_DAYS + 1; day <= 0; day++) {
      const date = this.dateStr(config.year, monthIdx, day);
      for (const state of states) {
        const shift = anchors.get(`${state.member.id}|${date}`);
        this.applyDay(state, day, shift ?? ShiftType.None, false);
      }
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = this.dateStr(config.year, monthIdx, day);
      const dayOfWeek = new Date(config.year, monthIdx, day).getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday & Saturday
      const isHoliday = holidays.has(date);

      const required: Record<ShiftKind, number> = isHoliday
        ? { Morning: limits.minMorningHoliday, Evening: limits.minEveningHoliday, Night: limits.minNightHoliday }
        : isWeekend
          ? { Morning: limits.minMorningWeekend, Evening: limits.minEveningWeekend, Night: limits.minNightWeekend }
          : { Morning: limits.minMorning, Evening: limits.minEvening, Night: limits.minNight };

      // Place anchors for the day first — they are never overwritten.
      const dayShifts = new Map<string, ShiftType>();
      for (const state of states) {
        const anchored = anchors.get(`${state.member.id}|${date}`);
        if (anchored !== undefined) {
          dayShifts.set(state.member.id, anchored);
          report.anchorsPreserved++;
        }
      }

      // Night first: it is the most constrained shift and it drives the next days' recovery.
      for (const kind of ['Night', 'Evening', 'Morning'] as ShiftKind[]) {
        this.fillShift(kind, day, date, required[kind], states, dayShifts, limits, category, report);
      }

      // Anyone without a duty is off, then roll the per-staff running state forward.
      for (const state of states) {
        const shift = dayShifts.get(state.member.id) ?? ShiftType.Off;
        dayShifts.set(state.member.id, shift);
        this.applyDay(state, day, shift, true);
      }
    }

    const assignments: Assignment[] = [];
    for (const state of states) {
      for (let day = 1; day <= daysInMonth; day++) {
        const shift = state.byDay.get(day);
        if (shift === undefined || shift === ShiftType.None) continue;
        assignments.push({ staffId: state.member.id, date: this.dateStr(config.year, monthIdx, day), shift });
      }
    }
    return assignments;
  }

  /** Day numbers within the month where this member has a fixed, unmovable duty. */
  private anchorDutyDays(
    member: StaffMember,
    anchors: Map<string, ShiftType>,
    config: RosterConfig,
    monthIdx: number,
    daysInMonth: number,
  ): Map<number, ShiftType> {
    const days = new Map<number, ShiftType>();
    for (let day = 1; day <= daysInMonth; day++) {
      const shift = anchors.get(`${member.id}|${this.dateStr(config.year, monthIdx, day)}`);
      if (shift !== undefined && DUTY_CODES.has(shift)) days.set(day, shift);
    }
    return days;
  }

  private fillShift(
    kind: ShiftKind,
    day: number,
    date: string,
    required: number,
    states: StaffState[],
    dayShifts: Map<string, ShiftType>,
    limits: Limits,
    category: StaffCategory,
    report: SchedulerReport,
  ): void {
    if (required <= 0) return;

    const codes = kind === 'Morning' ? MORNING_CODES : kind === 'Evening' ? EVENING_CODES : NIGHT_CODES;
    const target = kind === 'Morning' ? ShiftType.Morning : kind === 'Evening' ? ShiftType.Evening : ShiftType.Night;

    const inShift = () =>
      states.filter((s) => {
        const shift = dayShifts.get(s.member.id);
        return shift !== undefined && codes.has(shift);
      });

    while (inShift().length < required) {
      const current = inShift();
      const seniorsPresent = current.filter((s) => s.member.isSenior).length;
      const malesPresent = current.filter((s) => s.member.isMale).length;
      const needSenior = limits.applyBalanceRules && seniorsPresent < limits.minSenior;

      const candidates = states.filter((state) => {
        if (dayShifts.has(state.member.id)) return false;
        if (!this.isEligible(state, kind, day, limits)) return false;
        if (limits.applyBalanceRules && state.member.isMale && malesPresent >= limits.maxMale) return false;
        return true;
      });

      if (candidates.length === 0) break;

      // Prefer a senior while the seniority quota is unmet, but never stall on it.
      const pool = needSenior && candidates.some((c) => c.member.isSenior)
        ? candidates.filter((c) => c.member.isSenior)
        : candidates;

      const best = pool.reduce((a, b) => (this.score(a, kind) <= this.score(b, kind) ? a : b));
      dayShifts.set(best.member.id, target);
    }

    const filled = inShift();
    if (filled.length < required) {
      report.shortfalls.push({ date, day, shift: kind, category, required, filled: filled.length });
    }
    if (limits.applyBalanceRules) {
      const seniors = filled.filter((s) => s.member.isSenior).length;
      if (seniors < limits.minSenior) {
        report.seniorGaps.push({ date, day, shift: kind, required: limits.minSenior, filled: seniors });
      }
    }
  }

  /** Lower is better: spread duties by proportion of each person's own monthly capacity. */
  private score(state: StaffState, kind: ShiftKind): number {
    const remaining =
      kind === 'Morning'
        ? state.member.maxMorning - state.counts.morning
        : kind === 'Evening'
          ? state.member.maxEvening - state.counts.evening
          : state.member.maxNight - state.counts.night;

    return (state.totalDuties / state.capacity) * 1000 - remaining * 2 + state.index * 0.001;
  }

  private isEligible(state: StaffState, kind: ShiftKind, day: number, limits: Limits): boolean {
    // Monthly per-person caps.
    if (kind === 'Morning' && state.counts.morning >= state.member.maxMorning) return false;
    if (kind === 'Evening' && state.counts.evening >= state.member.maxEvening) return false;
    if (kind === 'Night' && state.counts.night >= state.member.maxNight) return false;

    // Maximum consecutive working days before a day off.
    if (limits.maxConsecutiveDuty > 0 && state.consecutiveDuty >= limits.maxConsecutiveDuty) return false;

    const daysSinceNight = day - state.lastNightDay;

    if (kind === 'Night') {
      // Cap the length of a night run. Enforced on its own, so it still holds when
      // there is no recovery period configured.
      if (limits.maxConsecutiveNight > 0 && state.nightRun >= limits.maxConsecutiveNight) return false;
      // Outside an in-progress run, respect the recovery window.
      if (daysSinceNight !== 1 && daysSinceNight <= limits.offAfterNight) return false;
    } else {
      // Recovery days after a night series are strictly off.
      if (daysSinceNight <= limits.offAfterNight) return false;
      // Never a night immediately followed by a morning.
      if (kind === 'Morning' && daysSinceNight === 1) return false;
    }

    if (kind === 'Evening' && limits.maxConsecutiveEvening > 0 && state.eveningRun >= limits.maxConsecutiveEvening) {
      return false;
    }

    // Look ahead at anchors: they cannot move, so never create a state that breaks one.
    if (kind === 'Night') {
      // A night here would drag a fixed duty into this person's recovery window.
      for (let k = 1; k <= limits.offAfterNight; k++) {
        if (state.anchorDutyDays.has(day + k)) return false;
      }
      // Guards the night → morning rule when there is no recovery period at all.
      const tomorrow = state.anchorDutyDays.get(day + 1);
      if (tomorrow !== undefined && MORNING_CODES.has(tomorrow)) return false;
    }

    // Working today would carry the duty run into a fixed duty past the consecutive cap.
    if (
      limits.maxConsecutiveDuty > 0 &&
      state.consecutiveDuty + 1 >= limits.maxConsecutiveDuty &&
      state.anchorDutyDays.has(day + 1)
    ) {
      return false;
    }

    return true;
  }

  private applyDay(state: StaffState, day: number, shift: ShiftType, countTowardsMonth: boolean): void {
    state.byDay.set(day, shift);

    const isDuty = DUTY_CODES.has(shift);
    state.consecutiveDuty = isDuty ? state.consecutiveDuty + 1 : 0;

    if (NIGHT_CODES.has(shift)) {
      state.nightRun += 1;
      state.lastNightDay = day;
    } else {
      state.nightRun = 0;
    }

    state.eveningRun = EVENING_CODES.has(shift) ? state.eveningRun + 1 : 0;

    if (!countTowardsMonth) return;

    if (isDuty) state.totalDuties += 1;
    if (MORNING_CODES.has(shift)) state.counts.morning += 1;
    else if (EVENING_CODES.has(shift)) state.counts.evening += 1;
    else if (NIGHT_CODES.has(shift)) state.counts.night += 1;
  }
}
