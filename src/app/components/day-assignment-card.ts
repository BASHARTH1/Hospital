import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Assignment, RosterConfig, ShiftType, StaffMember, isHaStaff, pad2 } from '../models/types';
import { OnCallThemeStyles } from './on-call-table';

interface Counterpart {
  id: string;
  name: string;
}

interface PersonCell {
  id: string;
  name: string;
  isSenior: boolean;
  isHa: boolean;
  counterparts: Counterpart[];
  /** First HA in the column gets the separator rule above it. */
  isFirstHa: boolean;
}

interface RosterRow {
  index: number;
  m: PersonCell | null;
  e: PersonCell | null;
  n: PersonCell | null;
  isLastRow: boolean;
}

interface WorkshopEntry extends PersonCell {
  position: number;
  isSpecial: boolean;
}

const MORNING_CODES = [ShiftType.Morning, ShiftType.RequestedMorning];
const EVENING_CODES = [ShiftType.Evening, ShiftType.RequestedEvening];
const NIGHT_CODES = [ShiftType.Night, ShiftType.RequestedNight];

/** A single day's printable assignment sheet, matching the physical roster chart. */
@Component({
  selector: 'app-day-assignment-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './day-assignment-card.html',
})
export class DayAssignmentCard {
  readonly staff = input.required<StaffMember[]>();
  readonly assignments = input.required<Assignment[]>();
  readonly config = input.required<RosterConfig>();
  readonly dayNum = input.required<number>();
  readonly monthIdx = input.required<number>();
  readonly shortMonthName = input.required<string>();
  readonly numRows = input.required<number>();
  readonly themeStyles = input.required<OnCallThemeStyles>();
  readonly notes = input('');
  readonly isPrint = input(false);

  readonly notesChange = output<string>();

  readonly dateStr = computed(
    () => `${this.config().year}-${pad2(this.monthIdx() + 1)}-${pad2(this.dayNum())}`,
  );

  readonly weekdayName = computed(() =>
    new Date(this.config().year, this.monthIdx(), this.dayNum()).toLocaleDateString('en-US', { weekday: 'long' }),
  );

  readonly weekdayShort = computed(() => this.weekdayName().substring(0, 3));

  private counterpartsFor(staffId: string): Counterpart[] {
    const dateStr = this.dateStr();
    return this.staff()
      .filter(
        (s) =>
          s.isCounterPart &&
          s.counterPartOf === staffId &&
          (!s.counterPartStart || dateStr >= s.counterPartStart) &&
          (!s.counterPartEnd || dateStr <= s.counterPartEnd),
      )
      .map((s) => ({ id: s.id, name: s.name || s.id }));
  }

  /** Staff on the given shift codes, HA staff last, seniors first, then by name. */
  private staffForShift(codes: ShiftType[]): StaffMember[] {
    const dateStr = this.dateStr();
    const staff = this.staff();
    return this.assignments()
      .filter((a) => a.date === dateStr && codes.includes(a.shift))
      .map((a) => staff.find((s) => s.id === a.staffId))
      .filter((s): s is StaffMember => !!s && !s.isCounterPart)
      .sort((a, b) => {
        const isHaA = isHaStaff(a.name);
        const isHaB = isHaStaff(b.name);
        if (isHaA && !isHaB) return 1;
        if (!isHaA && isHaB) return -1;
        if (a.isSenior && !b.isSenior) return -1;
        if (!a.isSenior && b.isSenior) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  private toPersonCell(member: StaffMember, isFirstHa: boolean): PersonCell {
    return {
      id: member.id,
      name: member.name,
      isSenior: member.isSenior,
      isHa: isHaStaff(member.name),
      counterparts: this.counterpartsFor(member.id),
      isFirstHa,
    };
  }

  /** Pads the column to `totalRows` and pushes HA staff to the bottom. */
  private separatedRows(staffList: StaffMember[], totalRows: number): (PersonCell | null)[] {
    const regulars = staffList.filter((s) => !isHaStaff(s.name));
    const has = staffList.filter((s) => isHaStaff(s.name));

    const requiredLength = Math.max(totalRows, regulars.length + has.length);
    const rows = new Array<PersonCell | null>(requiredLength).fill(null);

    regulars.forEach((s, idx) => {
      rows[idx] = this.toPersonCell(s, false);
    });

    has.forEach((s, idx) => {
      const targetIdx = requiredLength - has.length + idx;
      rows[targetIdx] = this.toPersonCell(s, idx === 0);
    });

    return rows;
  }

  readonly rosterRows = computed<RosterRow[]>(() => {
    const numRows = this.numRows();
    const morning = this.separatedRows(this.staffForShift(MORNING_CODES), numRows);
    const evening = this.separatedRows(this.staffForShift(EVENING_CODES), numRows);
    const night = this.separatedRows(this.staffForShift(NIGHT_CODES), numRows);

    const maxLen = Math.max(numRows, morning.length, evening.length, night.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      index: i,
      m: morning[i] ?? null,
      e: evening[i] ?? null,
      n: night[i] ?? null,
      isLastRow: i === maxLen - 1,
    }));
  });

  readonly workshopStaff = computed<WorkshopEntry[]>(() => {
    const dateStr = this.dateStr();
    const assignments = this.assignments();
    return this.staffForShift([ShiftType.MorningSpecial]).map((s, idx) => ({
      ...this.toPersonCell(s, false),
      position: idx + 1,
      isSpecial: assignments.some(
        (a) => a.staffId === s.id && a.date === dateStr && a.shift === ShiftType.MorningSpecial,
      ),
    }));
  });

  readonly morningOncalls = computed(() =>
    this.staffForShift([ShiftType.MorningOnCall]).map((s) => this.toPersonCell(s, false)),
  );
  readonly eveningOncalls = computed(() =>
    this.staffForShift([ShiftType.EveningOnCall]).map((s) => this.toPersonCell(s, false)),
  );
  readonly nightOncalls = computed(() =>
    this.staffForShift([ShiftType.NightOnCall]).map((s) => this.toPersonCell(s, false)),
  );

  onNotesInput(event: Event): void {
    this.notesChange.emit((event.target as HTMLTextAreaElement).value);
  }
}
