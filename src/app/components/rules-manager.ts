import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MONTHS, YEARS } from '../constants';
import { Assignment, RosterConfig, ShiftType, StaffMember, isHaStaff, pad2 } from '../models/types';
import { Icon } from '../ui/icon';

type RuleCategory = 'regular' | 'ha';
type NumericKey = keyof RosterConfig;

interface HolidayDay {
  day: number;
  dayOfWeekName: string;
  dateStr: string;
  isSelected: boolean;
  isWeekend: boolean;
}

@Component({
  selector: 'app-rules-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './rules-manager.html',
})
export class RulesManager {
  readonly config = input.required<RosterConfig>();
  readonly staff = input.required<StaffMember[]>();
  readonly assignments = input.required<Assignment[]>();

  readonly configChange = output<RosterConfig>();

  readonly activeCategory = signal<RuleCategory>('regular');
  readonly isHAActive = computed(() => this.activeCategory() === 'ha');

  readonly months = MONTHS;
  readonly years = YEARS;

  private readonly monthIdx = computed(() => MONTHS.indexOf(this.config().month));

  readonly daysInMonth = computed(() => new Date(this.config().year, this.monthIdx() + 1, 0).getDate());

  readonly holidayDays = computed<HolidayDay[]>(() => {
    const config = this.config();
    const monthIdx = this.monthIdx();
    return Array.from({ length: this.daysInMonth() }, (_, i) => {
      const d = i + 1;
      const dateObj = new Date(config.year, monthIdx, d);
      const dateStr = `${config.year}-${pad2(monthIdx + 1)}-${pad2(d)}`;
      const dayOfWeek = dateObj.getDay();
      return {
        day: d,
        dayOfWeekName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr,
        isSelected: !!config.holidays?.includes(dateStr),
        isWeekend: dayOfWeek === 5 || dayOfWeek === 6, // Friday & Saturday
      };
    });
  });

  handleChange(key: NumericKey, value: unknown): void {
    this.configChange.emit({ ...this.config(), [key]: value });
  }

  getValue(key: NumericKey, haKey?: NumericKey): number | string {
    const config = this.config();
    if (this.isHAActive() && haKey) {
      return (config[haKey] ?? config[key]) as number;
    }
    return config[key] as number;
  }

  handleValueChange(key: NumericKey, haKey: NumericKey | undefined, raw: string): void {
    const value = parseInt(raw) || 0;
    if (this.isHAActive() && haKey) {
      this.configChange.emit({ ...this.config(), [haKey]: value });
    } else {
      this.configChange.emit({ ...this.config(), [key]: value });
    }
  }

  toggleHoliday(dayNum: number): void {
    const config = this.config();
    const dateStr = `${config.year}-${pad2(this.monthIdx() + 1)}-${pad2(dayNum)}`;
    const currentHolidays = config.holidays || [];
    const updated = currentHolidays.includes(dateStr)
      ? currentHolidays.filter((h) => h !== dateStr)
      : [...currentHolidays, dateStr];
    this.handleChange('holidays', updated);
  }

  /**
   * Rough capacity model: how many duty slots the month demands versus what the
   * current head-count can realistically cover.
   */
  readonly smartAnalysis = computed(() => {
    const config = this.config();
    const monthIdx = this.monthIdx();
    const daysInMonth = this.daysInMonth();
    const isHA = this.isHAActive();

    const targetStaff = this.staff().filter(
      (s) => !s.isCounterPart && (isHA ? isHaStaff(s.name) : !isHaStaff(s.name)),
    );

    const minM = isHA ? (config.haMinMorning ?? config.minMorning) : config.minMorning;
    const minE = isHA ? (config.haMinEvening ?? config.minEvening) : config.minEvening;
    const minN = isHA ? (config.haMinNight ?? config.minNight) : config.minNight;

    const minMWeekend = isHA ? (config.haMinMorningWeekend ?? config.minMorningWeekend) : config.minMorningWeekend;
    const minEWeekend = isHA ? (config.haMinEveningWeekend ?? config.minEveningWeekend) : config.minEveningWeekend;
    const minNWeekend = isHA ? (config.haMinNightWeekend ?? config.minNightWeekend) : config.minNightWeekend;

    const minMHoliday = isHA
      ? (config.haMinMorningHoliday ?? config.minMorningHoliday ?? config.minMorning)
      : (config.minMorningHoliday ?? config.minMorning);
    const minEHoliday = isHA
      ? (config.haMinEveningHoliday ?? config.minEveningHoliday ?? config.minEvening)
      : (config.minEveningHoliday ?? config.minEvening);
    const minNHoliday = isHA
      ? (config.haMinNightHoliday ?? config.minNightHoliday ?? config.minNight)
      : (config.minNightHoliday ?? config.minNight);

    let totalSlotsRequired = 0;
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const dayOfWeek = new Date(config.year, monthIdx, dNum).getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday & Saturday
      const dateStr = `${config.year}-${pad2(monthIdx + 1)}-${pad2(dNum)}`;
      const isHoliday = config.holidays?.includes(dateStr);

      if (isHoliday) totalSlotsRequired += minMHoliday + minEHoliday + minNHoliday;
      else if (isWeekend) totalSlotsRequired += minMWeekend + minEWeekend + minNWeekend;
      else totalSlotsRequired += minM + minE + minN;
    }

    // Standard availability factor: 0.71 (approx 5/7 days)
    const staffCapacityFactor = 0.71;
    const slotsPerStaffMember = daysInMonth * staffCapacityFactor;
    const minStaffNeeded = Math.ceil(totalSlotsRequired / slotsPerStaffMember);

    const workingStaffCount = targetStaff.length;
    const leaveDays = this.assignments().filter(
      (a) => a.shift === ShiftType.Leave && targetStaff.some((s) => s.id === a.staffId),
    ).length;

    const totalPossibleSlots = workingStaffCount * daysInMonth;
    const netEffectiveCapacity = Math.floor((totalPossibleSlots - leaveDays) * staffCapacityFactor);

    const deficit = totalSlotsRequired - netEffectiveCapacity;
    const ratio = workingStaffCount / (minStaffNeeded || 1);
    const maxLeaveAllowed = Math.max(0, Math.floor(workingStaffCount - totalSlotsRequired / slotsPerStaffMember));

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (ratio < 0.9) status = 'critical';
    else if (ratio < 1.1) status = 'warning';

    return {
      totalSlotsRequired,
      netEffectiveCapacity,
      leaveDays,
      status,
      deficit,
      minStaffNeeded,
      maxLeaveAllowed,
      workingStaffCount,
    };
  });

  readonly insightBannerClass = computed(() => {
    switch (this.smartAnalysis().status) {
      case 'critical':
        return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300';
      case 'warning':
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
      default:
        return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
    }
  });

  readonly insightIcon = computed(() => (this.smartAnalysis().status === 'healthy' ? 'CheckCircle2' : 'Info'));

  readonly deficitClass = computed(() =>
    this.smartAnalysis().deficit > 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-emerald-600 dark:text-emerald-400',
  );

  readonly leaveClass = computed(() =>
    this.smartAnalysis().maxLeaveAllowed > 0
      ? 'text-slate-900 dark:text-slate-100'
      : 'text-rose-600 dark:text-rose-400',
  );

  readonly insightMessage = computed(() => {
    const a = this.smartAnalysis();
    if (a.status === 'critical') {
      return `Insufficient Staff: You are ${a.minStaffNeeded - this.staff().length} short. Roster generation may fail.`;
    }
    if (a.status === 'warning') {
      return `Borderline Coverage: Minimum requirements met, but only ${a.maxLeaveAllowed} person can safely take leave.`;
    }
    return `Optimal Staffing: You can afford to have up to ${a.maxLeaveAllowed} staff members on leave.`;
  });
}
