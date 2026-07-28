import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { MONTHS } from '../constants';
import { Assignment, RosterConfig, ShiftType, StaffMember, isHaStaff, pad2 } from '../models/types';
import { useDynamicStyle } from '../ui/dynamic-style';
import { Icon } from '../ui/icon';
import { OnCallPerson, OnCallRow, OnCallTable, OnCallThemeStyles } from './on-call-table';

type PrintTheme = 'slate' | 'teal' | 'indigo' | 'amber' | 'emerald';
type PrintOrientation = 'portrait' | 'landscape';

const THEME_CONFIGS: Record<PrintTheme, OnCallThemeStyles> = {
  slate: {
    headerBg: 'bg-slate-100 text-slate-800 border-slate-900',
    subHeaderBg: 'bg-slate-50 text-slate-600',
    borderColor: 'border-slate-900',
    accentText: 'text-slate-950',
    badgeBg: 'bg-slate-900',
    badgeText: 'text-white',
    bgTint: 'bg-slate-50/50',
  },
  teal: {
    headerBg: 'bg-teal-100/80 text-teal-900 border-teal-900',
    subHeaderBg: 'bg-teal-50/80 text-teal-800',
    borderColor: 'border-teal-900',
    accentText: 'text-teal-700',
    badgeBg: 'bg-teal-800',
    badgeText: 'text-teal-50',
    bgTint: 'bg-teal-50/40',
  },
  indigo: {
    headerBg: 'bg-indigo-100/80 text-indigo-900 border-indigo-900',
    subHeaderBg: 'bg-indigo-50/80 text-indigo-800',
    borderColor: 'border-indigo-900',
    accentText: 'text-indigo-700',
    badgeBg: 'bg-indigo-800',
    badgeText: 'text-indigo-50',
    bgTint: 'bg-indigo-50/40',
  },
  amber: {
    headerBg: 'bg-amber-100/80 text-amber-900 border-amber-900',
    subHeaderBg: 'bg-amber-50/80 text-amber-800',
    borderColor: 'border-amber-900',
    accentText: 'text-amber-700',
    badgeBg: 'bg-amber-800',
    badgeText: 'text-amber-50',
    bgTint: 'bg-amber-50/40',
  },
  emerald: {
    headerBg: 'bg-emerald-100/80 text-emerald-900 border-emerald-900',
    subHeaderBg: 'bg-emerald-50/80 text-emerald-800',
    borderColor: 'border-emerald-900',
    accentText: 'text-emerald-700',
    badgeBg: 'bg-emerald-800',
    badgeText: 'text-emerald-50',
    bgTint: 'bg-emerald-50/40',
  },
};

@Component({
  selector: 'app-on-call-print-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, OnCallTable],
  templateUrl: './on-call-print-view.html',
})
export class OnCallPrintView {
  readonly staff = input.required<StaffMember[]>();
  readonly config = input.required<RosterConfig>();
  readonly assignments = input.required<Assignment[]>();

  readonly back = output<void>();

  readonly selectedDays = signal<number[]>([]);
  readonly printTheme = signal<PrintTheme>('slate');
  readonly printOrientation = signal<PrintOrientation>('portrait');
  readonly hideEmptyDays = signal(false);

  readonly printedOn = new Date().toLocaleDateString();

  constructor() {
    // All days are selected whenever the month length changes.
    effect(() => {
      const days = this.daysInMonth();
      this.selectedDays.set(Array.from({ length: days }, (_, i) => i + 1));
    });

    useDynamicStyle(this.printConfigStyle);
  }

  private readonly monthIdx = computed(() => {
    const idx = MONTHS.indexOf(this.config().month);
    return idx === -1 ? 0 : idx;
  });

  readonly daysInMonth = computed(() => new Date(this.config().year, this.monthIdx() + 1, 0).getDate());

  readonly dayCells = computed(() => {
    const config = this.config();
    const monthIdx = this.monthIdx();
    return Array.from({ length: this.daysInMonth() }, (_, i) => {
      const dayNum = i + 1;
      const dayOfWeek = new Date(config.year, monthIdx, dayNum).getDay();
      return { dayNum, isWeekend: dayOfWeek === 5 || dayOfWeek === 6 };
    });
  });

  readonly themeStyles = computed(() => THEME_CONFIGS[this.printTheme()] || THEME_CONFIGS.slate);

  private toPerson(s: StaffMember): OnCallPerson {
    return { id: s.id, name: s.name, phone: s.phone, isSenior: s.isSenior, isHa: isHaStaff(s.name) };
  }

  private getStaffForOnCall(dayNum: number, shiftCode: ShiftType): StaffMember[] {
    const config = this.config();
    const dateStr = `${config.year}-${pad2(this.monthIdx() + 1)}-${pad2(dayNum)}`;
    const staff = this.staff();
    return this.assignments()
      .filter((a) => a.date === dateStr && a.shift === shiftCode)
      .map((a) => staff.find((s) => s.id === a.staffId))
      .filter((s): s is StaffMember => !!s)
      .sort((a, b) => {
        if (a.isSenior && !b.isSenior) return -1;
        if (!a.isSenior && b.isSenior) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  /** Rows that actually get printed, after day selection and the empty-day filter. */
  readonly rows = computed<OnCallRow[]>(() => {
    const config = this.config();
    const monthIdx = this.monthIdx();
    const selected = this.selectedDays();
    const hideEmpty = this.hideEmptyDays();

    const rows: OnCallRow[] = [];
    for (let dayNum = 1; dayNum <= this.daysInMonth(); dayNum++) {
      if (!selected.includes(dayNum)) continue;

      const morning = this.getStaffForOnCall(dayNum, ShiftType.MorningOnCall);
      const evening = this.getStaffForOnCall(dayNum, ShiftType.EveningOnCall);
      const night = this.getStaffForOnCall(dayNum, ShiftType.NightOnCall);

      if (hideEmpty && morning.length === 0 && evening.length === 0 && night.length === 0) continue;

      const date = new Date(config.year, monthIdx, dayNum);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const isHoliday = !!config.holidays?.includes(`${config.year}-${pad2(monthIdx + 1)}-${pad2(dayNum)}`);

      let rowBg = 'bg-white';
      let dateBadgeStyle = 'font-bold text-gray-800';
      if (isHoliday) {
        rowBg = 'bg-rose-50/50';
        dateBadgeStyle = 'font-black text-rose-700';
      } else if (isWeekend) {
        rowBg = 'bg-amber-50/30';
        dateBadgeStyle = 'font-black text-amber-700';
      }

      rows.push({
        dayNum,
        weekdayShort: date.toLocaleDateString('en-US', { weekday: 'long' }).substring(0, 3),
        isHoliday,
        rowBg,
        dateBadgeStyle,
        morning: morning.map((s) => this.toPerson(s)),
        evening: evening.map((s) => this.toPerson(s)),
        night: night.map((s) => this.toPerson(s)),
      });
    }
    return rows;
  });

  isDaySelected(day: number): boolean {
    return this.selectedDays().includes(day);
  }

  toggleDaySelection(day: number): void {
    this.selectedDays.update((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  selectAll(): void {
    this.selectedDays.set(Array.from({ length: this.daysInMonth() }, (_, i) => i + 1));
  }

  selectNone(): void {
    this.selectedDays.set([]);
  }

  selectWeekdays(): void {
    this.selectedDays.set(this.dayCells().filter((d) => !d.isWeekend).map((d) => d.dayNum));
  }

  selectWeekends(): void {
    this.selectedDays.set(this.dayCells().filter((d) => d.isWeekend).map((d) => d.dayNum));
  }

  print(): void {
    window.print();
  }

  readonly printConfigStyle = computed(
    () => `
      @media print {
        @page {
          size: ${this.printOrientation()} !important;
          margin: 10mm 12mm 10mm 12mm !important;
        }
        body {
          background: white !important;
          color: black !important;
        }
        .no-print {
          display: none !important;
        }
        .print-oncall-container {
          display: block !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        input, textarea {
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          resize: none !important;
        }
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `,
  );
}
