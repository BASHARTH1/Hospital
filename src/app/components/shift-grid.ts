import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { ALL_SHIFT_TYPES, SHIFT_STYLES, ShiftStyle } from '../constants';
import { Assignment, RosterConfig, ShiftType, StaffMember, isHaStaff, pad2 } from '../models/types';
import { Icon } from '../ui/icon';

interface DayInfo {
  day: number;
  month: number;
  year: number;
  dateStr: string;
  dayName: string;
  isContext: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  /** Heavier border that separates the trailing context days from day 1. */
  isDivider: boolean;
}

interface GridCell {
  dateStr: string;
  shift: ShiftType;
  displayValue: string;
  classes: string;
  title: string;
  isContext: boolean;
  isDivider: boolean;
  isRequested: boolean;
}

interface GridRow {
  member: StaffMember;
  isCP: boolean;
  isHa: boolean;
  cells: GridCell[];
  totals: { morning: number; evening: number; night: number; off: number; leave: number; holiday: number };
}

interface ShiftBreakdown {
  total: number;
  seniors: number;
  males: number;
  targetMin: number;
  isShort: boolean;
  seniorShort: boolean;
  maleOver: boolean;
}

interface DayStats {
  dateStr: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isDivider: boolean;
  dayLabel: string;
  m: ShiftBreakdown;
  e: ShiftBreakdown;
  n: ShiftBreakdown;
}

interface ActiveCell {
  staffId: string;
  dateStr: string;
  viewportX: number;
  viewportY: number;
  shouldFlip: boolean;
}

/**
 * Drops any `ring-*` utility baked into a shift swatch.
 *
 * "Requested" shifts get an explicit red inset ring from the template. Leaving another
 * ring on the element too would put two competing `ring` utilities on one node, and
 * which one wins depends purely on their order in the compiled stylesheet.
 */
function stripRings(classes: string): string {
  return classes
    .replace(/\bring-\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const MORNING_SHIFTS = [
  ShiftType.Morning,
  ShiftType.RequestedMorning,
  ShiftType.MorningSpecial,
  ShiftType.MorningOnCall,
];
const EVENING_SHIFTS = [ShiftType.Evening, ShiftType.RequestedEvening, ShiftType.EveningOnCall];
const NIGHT_SHIFTS = [ShiftType.Night, ShiftType.RequestedNight, ShiftType.NightOnCall];

@Component({
  selector: 'app-shift-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './shift-grid.html',
  host: { '(document:mousedown)': 'onDocumentMouseDown($event)' },
})
export class ShiftGrid {
  readonly staff = input.required<StaffMember[]>();
  readonly config = input.required<RosterConfig>();
  readonly assignments = input.required<Assignment[]>();
  readonly readOnly = input(false);
  readonly hideContextDays = input(false);

  readonly update = output<Assignment>();
  readonly updateBatch = output<Assignment[]>();

  readonly activeCell = signal<ActiveCell | null>(null);
  private readonly menuRef = viewChild<ElementRef<HTMLElement>>('menu');

  readonly ShiftType = ShiftType;
  readonly allShiftTypes = ALL_SHIFT_TYPES;
  readonly shiftStyles = SHIFT_STYLES;

  private readonly monthIdx = computed(() => {
    const c = this.config();
    return new Date(Date.parse(c.month + ' 1, ' + c.year)).getMonth();
  });

  private buildDay(d: Date, isContext: boolean, isDivider: boolean): DayInfo {
    const dayOfWeek = d.getDay();
    const dateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return {
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      dateStr,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isContext,
      isWeekend: dayOfWeek === 5 || dayOfWeek === 6,
      isHoliday: !!this.config().holidays?.includes(dateStr),
      isDivider,
    };
  }

  private readonly contextDays = computed<DayInfo[]>(() =>
    [-2, -1, 0].map((offset, idx) =>
      this.buildDay(new Date(this.config().year, this.monthIdx(), offset), true, idx === 2),
    ),
  );

  readonly currentMonthDays = computed<DayInfo[]>(() => {
    const year = this.config().year;
    const monthIdx = this.monthIdx();
    const totalDays = new Date(year, monthIdx + 1, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => this.buildDay(new Date(year, monthIdx, i + 1), false, false));
  });

  readonly allVisibleDays = computed<DayInfo[]>(() =>
    this.hideContextDays() ? this.currentMonthDays() : [...this.contextDays(), ...this.currentMonthDays()],
  );

  /** Everything the table body needs, precomputed once per data change. */
  readonly rows = computed<GridRow[]>(() => {
    const days = this.allVisibleDays();
    const monthDates = new Set(this.currentMonthDays().map((d) => d.dateStr));

    const shiftMap = new Map<string, ShiftType>();
    for (const a of this.assignments()) shiftMap.set(`${a.staffId}|${a.date}`, a.shift);

    return this.staff().map((member) => {
      const totals = { morning: 0, evening: 0, night: 0, off: 0, leave: 0, holiday: 0 };

      const cells = days.map((d) => {
        const shift = shiftMap.get(`${member.id}|${d.dateStr}`) ?? ShiftType.None;
        const style: ShiftStyle = SHIFT_STYLES[shift];

        if (monthDates.has(d.dateStr)) {
          if (MORNING_SHIFTS.includes(shift)) totals.morning++;
          else if (EVENING_SHIFTS.includes(shift)) totals.evening++;
          else if (NIGHT_SHIFTS.includes(shift)) totals.night++;
          else if (shift === ShiftType.Off || shift === ShiftType.RequestedOff) totals.off++;
          else if (shift === ShiftType.Leave) totals.leave++;
          else if (shift === ShiftType.PublicHoliday) totals.holiday++;
        }

        let displayValue: string = shift;
        if (shift === ShiftType.RequestedMorning) displayValue = '1';
        else if (shift === ShiftType.RequestedEvening) displayValue = '2';
        else if (shift === ShiftType.RequestedNight) displayValue = '3';
        else if (shift === ShiftType.RequestedOff) displayValue = 'W';
        else if (shift === ShiftType.None) displayValue = '·';

        const isRequested = shift.startsWith('R');

        return {
          dateStr: d.dateStr,
          shift,
          displayValue,
          classes: `shift-cell-${shift} ${isRequested ? stripRings(style.bg) : style.bg} ${style.color}`,
          title: member.isCounterPart
            ? 'Counterpart duty (mirrored)'
            : `${member.name || member.id} · ${d.dateStr} · ${style.description}`,
          isContext: d.isContext,
          isDivider: d.isDivider,
          isRequested,
        };
      });

      return {
        member,
        isCP: !!member.isCounterPart,
        isHa: isHaStaff(member.name),
        cells,
        totals,
      };
    });
  });

  /** Per-day headcount / seniority / gender breakdown rendered in the table footer. */
  readonly stats = computed<DayStats[]>(() => {
    const config = this.config();
    const staffById = new Map(this.staff().map((s) => [s.id, s]));
    const assignments = this.assignments();

    return this.allVisibleDays().map((dInfo) => {
      const dayAssignments = assignments.filter((a) => a.date === dInfo.dateStr);

      const breakdown = (codes: ShiftType[], min: number, minWeekend: number, minHoliday: number): ShiftBreakdown => {
        const matching = dayAssignments.filter((a) => {
          const assoc = staffById.get(a.staffId);
          if (assoc?.isCounterPart) return false;
          return codes.includes(a.shift);
        });
        const staffInShift = matching.map((a) => staffById.get(a.staffId)).filter((s): s is StaffMember => !!s);

        const targetMin = dInfo.isHoliday ? minHoliday : dInfo.isWeekend ? minWeekend : min;
        const total = matching.length;
        const seniors = staffInShift.filter((s) => s.isSenior && !isHaStaff(s.name)).length;
        const males = staffInShift.filter((s) => s.isMale && !isHaStaff(s.name)).length;

        return {
          total,
          seniors,
          males,
          targetMin,
          isShort: total < targetMin,
          seniorShort: seniors < config.minSenior,
          maleOver: males > config.maxMale,
        };
      };

      const m = breakdown(
        MORNING_SHIFTS,
        config.minMorning,
        config.minMorningWeekend ?? config.minMorning,
        config.minMorningHoliday ?? config.minMorning,
      );
      const e = breakdown(
        EVENING_SHIFTS,
        config.minEvening,
        config.minEveningWeekend ?? config.minEvening,
        config.minEveningHoliday ?? config.minEvening,
      );
      const n = breakdown(
        NIGHT_SHIFTS,
        config.minNight,
        config.minNightWeekend ?? config.minNight,
        config.minNightHoliday ?? config.minNight,
      );

      return {
        dateStr: dInfo.dateStr,
        isWeekend: dInfo.isWeekend,
        isHoliday: dInfo.isHoliday,
        isDivider: dInfo.isDivider,
        dayLabel: dInfo.isHoliday ? 'Holiday' : dInfo.isWeekend ? 'Weekend' : 'Weekday',
        m,
        e,
        n,
      };
    });
  });

  /** Total unfilled slots across the visible month, surfaced above the grid. */
  readonly shortfallCount = computed(
    () => this.stats().filter((s) => s.m.isShort).length
      + this.stats().filter((s) => s.e.isShort).length
      + this.stats().filter((s) => s.n.isShort).length,
  );

  minTitle(s: DayStats, kind: 'm' | 'e' | 'n'): string {
    const b = kind === 'm' ? s.m : kind === 'e' ? s.e : s.n;
    return `${s.dayLabel} minimum: ${b.targetMin} · rostered: ${b.total}`;
  }

  /** The colour of a day-header number. Exactly one class, so order cannot decide it. */
  dayNumberColor(d: DayInfo): string {
    if (d.isHoliday) return 'text-rose-600 dark:text-rose-400';
    if (d.isWeekend) return 'text-amber-600 dark:text-amber-400';
    if (d.isContext) return 'text-slate-300 dark:text-slate-600';
    return 'text-slate-700 dark:text-slate-200';
  }

  /** Header tint marking weekends and public holidays. */
  dayHeaderClass(d: DayInfo): string {
    if (d.isHoliday) return 'bg-rose-50 dark:bg-rose-500/10';
    if (d.isWeekend) return 'bg-amber-50 dark:bg-amber-500/10';
    if (d.isContext) return 'bg-slate-100/70 dark:bg-slate-800/50';
    return '';
  }

  legendLabel(shift: ShiftType): string {
    const key = shift as string;
    if (!key.startsWith('R')) return key;
    return key === 'RW' ? 'W' : key.charAt(1);
  }

  /** Legend swatch colours, with any baked-in ring removed for requested shifts. */
  legendSwatchClass(key: ShiftType): string {
    const details = SHIFT_STYLES[key];
    const bg = key.startsWith('R') ? stripRings(details.bg) : details.bg;
    return `${bg} ${details.color}`;
  }

  // ---- Interaction ----

  onCellClick(event: MouseEvent, row: GridRow, cell: GridCell): void {
    if (this.readOnly()) return;
    if (row.isCP) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuEstimatedHeight = 340;
    const shouldFlip = rect.bottom + menuEstimatedHeight > window.innerHeight;

    this.activeCell.set({
      staffId: row.member.id,
      dateStr: cell.dateStr,
      viewportX: rect.left,
      viewportY: shouldFlip ? rect.top : rect.bottom,
      shouldFlip,
    });
  }

  selectShift(shift: ShiftType): void {
    const cell = this.activeCell();
    if (!cell) return;
    this.update.emit({ staffId: cell.staffId, date: cell.dateStr, shift });
    this.activeCell.set(null);
  }

  apply15DayLeave(): void {
    const cell = this.activeCell();
    if (!cell) return;
    const [year, month, day] = cell.dateStr.split('-').map((p) => parseInt(p));
    if (!window.confirm(`Set 15 continuous days of leave for ${cell.staffId}, starting ${cell.dateStr}?`)) return;

    const batchUpdates: Assignment[] = [];
    const cursor = new Date(year, month - 1, day);
    for (let i = 0; i < 15; i++) {
      batchUpdates.push({
        staffId: cell.staffId,
        date: `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`,
        shift: ShiftType.Leave,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    this.updateBatch.emit(batchUpdates);
    this.activeCell.set(null);
  }

  closeMenu(): void {
    this.activeCell.set(null);
  }

  onDocumentMouseDown(event: MouseEvent): void {
    if (!this.activeCell()) return;
    const menu = this.menuRef()?.nativeElement;
    if (menu && !menu.contains(event.target as Node)) {
      this.activeCell.set(null);
    }
  }

  menuTop(cell: ActiveCell): string {
    return cell.shouldFlip ? 'auto' : `${cell.viewportY + 6}px`;
  }

  menuBottom(cell: ActiveCell): string {
    return cell.shouldFlip ? `${window.innerHeight - cell.viewportY + 6}px` : 'auto';
  }

  menuLeft(cell: ActiveCell): string {
    return `${Math.min(cell.viewportX, window.innerWidth - 240)}px`;
  }
}
