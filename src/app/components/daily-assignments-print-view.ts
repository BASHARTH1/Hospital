import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { MONTHS } from '../constants';
import { Assignment, RosterConfig, StaffMember } from '../models/types';
import { useDynamicStyle } from '../ui/dynamic-style';
import { Icon } from '../ui/icon';
import { DayAssignmentCard } from './day-assignment-card';
import { OnCallThemeStyles } from './on-call-table';

type DaysPerPage = '1' | '2' | 'continuous';
type PrintTheme = 'slate' | 'teal' | 'indigo' | 'amber' | 'emerald';
type ColorCategory = 'morning' | 'evening' | 'night' | 'workshop' | 'onCall' | 'notes';

const THEME_CONFIGS: Record<PrintTheme, OnCallThemeStyles> = {
  slate: {
    headerBg: 'bg-slate-100 text-slate-800',
    subHeaderBg: 'bg-slate-50 text-slate-600',
    borderColor: 'border-slate-900',
    accentText: 'text-slate-900',
    badgeBg: 'bg-slate-900',
    badgeText: 'text-white',
    bgTint: 'bg-slate-50/50',
  },
  teal: {
    headerBg: 'bg-teal-100/80 text-teal-900',
    subHeaderBg: 'bg-teal-50/80 text-teal-800',
    borderColor: 'border-teal-900',
    accentText: 'text-teal-700',
    badgeBg: 'bg-teal-800',
    badgeText: 'text-teal-50',
    bgTint: 'bg-teal-50/40',
  },
  indigo: {
    headerBg: 'bg-indigo-100/80 text-indigo-900',
    subHeaderBg: 'bg-indigo-50/80 text-indigo-800',
    borderColor: 'border-indigo-900',
    accentText: 'text-indigo-700',
    badgeBg: 'bg-indigo-800',
    badgeText: 'text-indigo-50',
    bgTint: 'bg-indigo-50/40',
  },
  amber: {
    headerBg: 'bg-amber-100/80 text-amber-900',
    subHeaderBg: 'bg-amber-50/80 text-amber-800',
    borderColor: 'border-amber-900',
    accentText: 'text-amber-700',
    badgeBg: 'bg-amber-800',
    badgeText: 'text-amber-50',
    bgTint: 'bg-amber-50/40',
  },
  emerald: {
    headerBg: 'bg-emerald-100/80 text-emerald-900',
    subHeaderBg: 'bg-emerald-50/80 text-emerald-800',
    borderColor: 'border-emerald-900',
    accentText: 'text-emerald-700',
    badgeBg: 'bg-emerald-800',
    badgeText: 'text-emerald-50',
    bgTint: 'bg-emerald-50/40',
  },
};

const DEFAULT_COLORS: Record<ColorCategory, string> = {
  morning: '#000000',
  evening: '#000000',
  night: '#000000',
  workshop: '#000000',
  onCall: '#000000',
  notes: '#000000',
};

const COLORS_STORAGE_KEY = 'roster_print_category_colors';

interface DayInputData {
  notes?: string;
}

@Component({
  selector: 'app-daily-assignments-print-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, DayAssignmentCard],
  templateUrl: './daily-assignments-print-view.html',
})
export class DailyAssignmentsPrintView {
  readonly staff = input.required<StaffMember[]>();
  readonly config = input.required<RosterConfig>();
  readonly assignments = input.required<Assignment[]>();

  readonly back = output<void>();

  readonly daysPerPage = signal<DaysPerPage>('2');
  readonly selectedDays = signal<number[]>([]);
  readonly numRows = signal(8);
  readonly printTheme = signal<PrintTheme>('slate');

  readonly categoryColors = signal<Record<ColorCategory, string>>(this.loadColors());
  readonly colorCategories: { key: ColorCategory; label: string }[] = [
    { key: 'morning', label: 'Morning' },
    { key: 'evening', label: 'Evening' },
    { key: 'night', label: 'Night' },
    { key: 'workshop', label: 'Workshop' },
    { key: 'onCall', label: 'On-Call' },
    { key: 'notes', label: 'Notes' },
  ];

  /** Free-text agenda notes, persisted per month in localStorage. */
  readonly inputsData = signal<Record<number, DayInputData>>({});

  constructor() {
    // Select every day whenever the month length changes.
    effect(() => {
      const days = this.daysInMonth();
      this.selectedDays.set(Array.from({ length: days }, (_, i) => i + 1));
    });

    // Reload saved notes when the roster period changes.
    effect(() => {
      const saved = localStorage.getItem(this.notesStorageKey());
      if (saved) {
        try {
          this.inputsData.set(JSON.parse(saved));
          return;
        } catch (e) {
          console.error('Error loading daily assignments inputs', e);
        }
      }
      this.inputsData.set({});
    });

    useDynamicStyle(this.printConfigStyle);
  }

  private loadColors(): Record<ColorCategory, string> {
    const saved = localStorage.getItem(COLORS_STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_COLORS, ...JSON.parse(saved) };
      } catch (e) {
        console.error(e);
      }
    }
    return { ...DEFAULT_COLORS };
  }

  readonly monthIdx = computed(() => {
    const idx = MONTHS.indexOf(this.config().month);
    return idx === -1 ? 0 : idx;
  });

  readonly daysInMonth = computed(() => new Date(this.config().year, this.monthIdx() + 1, 0).getDate());
  readonly shortMonthName = computed(() => this.config().month.substring(0, 3));
  readonly themeStyles = computed(() => THEME_CONFIGS[this.printTheme()] || THEME_CONFIGS.slate);

  private notesStorageKey(): string {
    return `roster_daily_inputs_${this.config().year}_${this.config().month}`;
  }

  readonly dayCells = computed(() => {
    const config = this.config();
    const monthIdx = this.monthIdx();
    return Array.from({ length: this.daysInMonth() }, (_, i) => {
      const dayNum = i + 1;
      const dayOfWeek = new Date(config.year, monthIdx, dayNum).getDay();
      return { dayNum, isWeekend: dayOfWeek === 5 || dayOfWeek === 6 };
    });
  });

  notesFor(dayNum: number): string {
    return this.inputsData()[dayNum]?.notes ?? '';
  }

  onNotesChange(dayNum: number, value: string): void {
    this.inputsData.update((prev) => {
      const updated = { ...prev, [dayNum]: { ...(prev[dayNum] || {}), notes: value } };
      localStorage.setItem(this.notesStorageKey(), JSON.stringify(updated));
      return updated;
    });
  }

  handleColorChange(category: ColorCategory, color: string): void {
    this.categoryColors.update((prev) => {
      const updated = { ...prev, [category]: color };
      localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  resetColors(): void {
    this.categoryColors.set({ ...DEFAULT_COLORS });
    localStorage.removeItem(COLORS_STORAGE_KEY);
  }

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

  setNumRows(raw: string): void {
    this.numRows.set(Math.max(4, parseInt(raw) || 8));
  }

  print(): void {
    window.print();
  }

  readonly printConfigStyle = computed(() => {
    let pagingRule = '';
    if (this.daysPerPage() === '1') {
      pagingRule = `
        .print-day-block {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          margin-bottom: 0 !important;
          height: 100vh !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
        }
      `;
    } else if (this.daysPerPage() === '2') {
      pagingRule = `
        .print-day-block {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          margin-bottom: 20px !important;
        }
        .print-day-block:nth-child(2n) {
          page-break-after: always !important;
          break-after: page !important;
        }
      `;
    } else {
      pagingRule = `
        .print-day-block {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          margin-bottom: 30px !important;
        }
      `;
    }

    const colors = this.categoryColors();
    return `
      @media print {
        @page {
          size: landscape !important;
          margin: 8mm 10mm 8mm 10mm !important;
        }
        body {
          background: white !important;
          color: black !important;
        }
        .no-print {
          display: none !important;
        }
        .print-days-container {
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
        input::placeholder, textarea::placeholder {
          color: transparent !important;
        }
        ${pagingRule}
      }

      /* Screen & print category colors */
      .print-color-morning, .print-color-morning .staff-name-text {
        color: ${colors.morning} !important;
      }
      .print-color-evening, .print-color-evening .staff-name-text {
        color: ${colors.evening} !important;
      }
      .print-color-night, .print-color-night .staff-name-text {
        color: ${colors.night} !important;
      }
      .print-color-workshop, .print-color-workshop .staff-name-text, .print-color-workshop td, .print-color-workshop span {
        color: ${colors.workshop} !important;
      }
      .print-color-oncall, .print-color-oncall .staff-name-text, .print-color-oncall span {
        color: ${colors.onCall} !important;
      }
      .print-color-notes, .print-color-notes textarea, .print-color-notes .notes-print-content {
        color: ${colors.notes} !important;
      }
    `;
  });
}
