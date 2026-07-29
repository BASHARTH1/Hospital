import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SHIFT_STYLES } from '../constants';
import { Assignment, RosterConfig, ShiftType, StaffMember, isHaStaff } from '../models/types';

export type CardColorMode = 'ClassicRetro' | 'AppTheme';

export interface GridCellTemplate {
  isPadding: boolean;
  dayNum: number | null;
  dateStr: string | null;
}

interface RenderedCell {
  key: string;
  isPadding: boolean;
  dayNum: number | null;
  shiftCode: string;
  cellBg: string;
  shiftTextColor: string;
  dayNumColor: string;
  showHolidayDot: boolean;
}

/** The classic high-contrast pocket calendar card for a single staff member. */
@Component({
  selector: 'app-staff-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="w-[240px] h-[180px] overflow-hidden select-none flex p-1.5 relative font-sans"
      [class]="outerBorderClass()"
    >
      <div class="flex-1 h-full flex flex-col justify-between p-1">
        <!-- Title: staff member name and seniority -->
        <div class="flex justify-between items-center border-b border-slate-200/60 pb-1">
          <div class="flex flex-col text-left">
            <span
              class="text-[10px] font-black uppercase tracking-tight leading-none truncate max-w-[130px]"
              [class]="isHa() ? 'text-emerald-700' : 'text-slate-800'"
            >
              {{ member().name || 'Anonymous' }}
            </span>
            <span class="text-[6px] font-bold text-slate-400 uppercase tracking-wider leading-none mt-0.5">
              {{ isHa() ? 'HA Staff' : member().isSenior ? 'Senior' : 'Junior' }} • {{ config().month }}
            </span>
          </div>
          <span
            class="text-[6.5px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-widest font-mono shrink-0"
          >
            {{ rosterTitle() || 'DUTY' }}
          </span>
        </div>

        <!-- Weekday header -->
        <div
          class="grid grid-cols-7 text-[7px] font-black uppercase text-center text-slate-400 border-b border-slate-200/50 py-0.5"
        >
          <span>S</span>
          <span>M</span>
          <span>T</span>
          <span>W</span>
          <span>T</span>
          <span class="text-amber-500 font-extrabold">F</span>
          <span class="text-amber-500 font-extrabold">S</span>
        </div>

        <!-- 7-column day grid -->
        <div
          class="grid grid-cols-7 gap-[1px] bg-slate-200/60 rounded overflow-hidden border border-slate-200/50"
        >
          @for (cell of cells(); track cell.key) {
            @if (cell.isPadding) {
              <div class="h-[15.5px]" [class]="cell.cellBg"></div>
            } @else {
              <div class="h-[15.5px] flex items-center justify-between px-1 relative select-none" [class]="cell.cellBg">
                <span class="text-[6.5px] font-bold leading-none" [class]="cell.dayNumColor">{{ cell.dayNum }}</span>
                @if (cell.shiftCode) {
                  <span
                    class="text-[8px] font-black font-mono leading-none tracking-tighter"
                    [class]="cell.shiftTextColor"
                    >{{ cell.shiftCode }}</span
                  >
                }
                @if (cell.showHolidayDot) {
                  <span class="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-rose-500 rounded-full"></span>
                }
              </div>
            }
          }
        </div>

        <!-- Footer -->
        <div
          class="flex justify-between items-center text-[5.5px] text-slate-400 uppercase font-black tracking-wider pt-1 border-t border-slate-200/60 mt-1"
        >
          <span class="truncate max-w-[120px]">{{ footerText() }}</span>
          <span>VALID FOR {{ shortMonthName() }} {{ config().year }}</span>
        </div>
      </div>
    </div>
  `,
})
export class StaffCard {
  readonly member = input.required<StaffMember>();
  readonly config = input.required<RosterConfig>();
  readonly assignments = input.required<Assignment[]>();
  readonly gridCells = input.required<GridCellTemplate[]>();
  readonly rosterTitle = input('');
  readonly footerText = input('');
  readonly colorMode = input<CardColorMode>('ClassicRetro');

  readonly isRetro = computed(() => this.colorMode() === 'ClassicRetro');
  readonly isHa = computed(() => isHaStaff(this.member().name));
  readonly shortMonthName = computed(() => this.config().month.substring(0, 3));

  readonly outerBorderClass = computed(() =>
    this.isRetro()
      ? 'rounded-md border-2 border-black bg-white text-black'
      : 'rounded-md border border-slate-200 bg-white text-slate-800 shadow-card dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  );

  readonly cells = computed<RenderedCell[]>(() => {
    const isRetro = this.isRetro();
    const config = this.config();
    const memberId = this.member().id;
    const themeStyles = SHIFT_STYLES;

    const shiftByDate = new Map<string, ShiftType>();
    for (const a of this.assignments()) {
      if (a.staffId === memberId) shiftByDate.set(a.date, a.shift);
    }

    return this.gridCells().map((cell, idx) => {
      if (cell.isPadding || !cell.dateStr) {
        return {
          key: `padding-${idx}`,
          isPadding: true,
          dayNum: null,
          shiftCode: '',
          cellBg: isRetro ? 'bg-white' : 'bg-transparent',
          shiftTextColor: '',
          dayNumColor: '',
          showHolidayDot: false,
        };
      }

      const shiftCode = shiftByDate.get(cell.dateStr) ?? ('' as ShiftType | '');
      const isWeekend = idx % 7 === 5 || idx % 7 === 6; // Fri or Sat
      const isHoliday = !!config.holidays?.includes(cell.dateStr);

      let cellBg = 'bg-white';
      let shiftTextColor = 'text-slate-800';
      let dayNumColor = 'text-slate-400';

      if (isRetro) {
        if (shiftCode === ShiftType.Off || shiftCode === ShiftType.RequestedOff) {
          cellBg = 'bg-gray-200 font-bold';
        } else if (isHoliday) {
          cellBg = 'bg-rose-100 font-bold';
        } else if (isWeekend) {
          cellBg = 'bg-amber-100 font-bold';
        }
      } else if (shiftCode && shiftCode !== ShiftType.None) {
        const shiftStyles = themeStyles[shiftCode as ShiftType];
        if (shiftStyles) {
          cellBg = shiftStyles.bg;
          shiftTextColor = shiftStyles.color;
        } else {
          cellBg = 'bg-slate-100';
        }
        if (isHoliday) cellBg += ' ring-1 ring-inset ring-rose-500/50';
        else if (isWeekend) cellBg += ' ring-1 ring-inset ring-amber-500/30';
      } else if (isHoliday) {
        cellBg = 'bg-rose-50/50';
        dayNumColor = 'text-rose-500 font-bold';
      } else if (isWeekend) {
        cellBg = 'bg-amber-50/50';
        dayNumColor = 'text-amber-500 font-bold';
      }

      return {
        key: cell.dateStr,
        isPadding: false,
        dayNum: cell.dayNum,
        shiftCode: shiftCode && shiftCode !== ShiftType.None ? shiftCode : '',
        cellBg,
        shiftTextColor,
        dayNumColor,
        showHolidayDot: !isRetro && isHoliday,
      };
    });
  });
}
