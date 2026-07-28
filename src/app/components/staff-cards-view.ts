import { ChangeDetectionStrategy, Component, OnInit, computed, effect, input, output, signal } from '@angular/core';
import { MONTHS } from '../constants';
import { Assignment, RosterConfig, StaffMember, ThemeType, pad2 } from '../models/types';
import { useDynamicStyle } from '../ui/dynamic-style';
import { Icon } from '../ui/icon';
import { CardColorMode, GridCellTemplate, StaffCard } from './staff-card';

type CardsPerPage = '1' | '2' | 'continuous';

@Component({
  selector: 'app-staff-cards-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, StaffCard],
  templateUrl: './staff-cards-view.html',
})
export class StaffCardsView implements OnInit {
  readonly staff = input.required<StaffMember[]>();
  readonly config = input.required<RosterConfig>();
  readonly assignments = input.required<Assignment[]>();
  readonly appTheme = input<ThemeType>('Professional');

  readonly back = output<void>();

  // Customizable card fields
  readonly rosterTitle = signal('208CCU');
  readonly footerText = signal('Done By 208 CCU');
  readonly colorMode = signal<CardColorMode>('ClassicRetro');
  readonly cardsPerPage = signal<CardsPerPage>('1');

  // Selection / filter state
  readonly selectedStaffIds = signal<string[]>([]);
  readonly searchQuery = signal('');

  constructor() {
    // Keep the card title/footer in step with the central ward name.
    effect(() => {
      const wardName = this.config().wardName;
      if (wardName) {
        this.rosterTitle.set(wardName);
        this.footerText.set(`Done By ${wardName}`);
      }
    });

    useDynamicStyle(this.printConfigStyle);
  }

  ngOnInit(): void {
    this.selectedStaffIds.set(this.staff().map((s) => s.id));
  }

  private readonly monthIdx = computed(() => {
    const idx = MONTHS.indexOf(this.config().month);
    return idx === -1 ? 0 : idx;
  });

  readonly shortMonthName = computed(() => this.config().month.substring(0, 3));
  readonly daysInMonth = computed(() => new Date(this.config().year, this.monthIdx() + 1, 0).getDate());
  private readonly startDayOfWeek = computed(() => new Date(this.config().year, this.monthIdx(), 1).getDay());

  /** Padded 7-column month layout shared by every card. */
  readonly gridCellsTemplate = computed<GridCellTemplate[]>(() => {
    const config = this.config();
    const monthIdx = this.monthIdx();
    const daysInMonth = this.daysInMonth();

    const paddingBefore: GridCellTemplate[] = Array.from({ length: this.startDayOfWeek() }, () => ({
      isPadding: true,
      dayNum: null,
      dateStr: null,
    }));

    const dayCells: GridCellTemplate[] = Array.from({ length: daysInMonth }, (_, i) => ({
      isPadding: false,
      dayNum: i + 1,
      dateStr: `${config.year}-${pad2(monthIdx + 1)}-${pad2(i + 1)}`,
    }));

    const totalCells = paddingBefore.length + dayCells.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    const paddingAfter: GridCellTemplate[] = Array.from({ length: remainingCells }, () => ({
      isPadding: true,
      dayNum: null,
      dateStr: null,
    }));

    return [...paddingBefore, ...dayCells, ...paddingAfter];
  });

  readonly filteredStaff = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.staff().filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  });

  readonly staffToRender = computed(() => this.staff().filter((s) => this.selectedStaffIds().includes(s.id)));

  isChecked(id: string): boolean {
    return this.selectedStaffIds().includes(id);
  }

  selectAll(): void {
    this.selectedStaffIds.set(this.staff().map((s) => s.id));
  }

  selectNone(): void {
    this.selectedStaffIds.set([]);
  }

  selectSeniors(): void {
    this.selectedStaffIds.set(this.staff().filter((s) => s.isSenior).map((s) => s.id));
  }

  selectJuniors(): void {
    this.selectedStaffIds.set(this.staff().filter((s) => !s.isSenior).map((s) => s.id));
  }

  toggleStaffSelection(id: string): void {
    this.selectedStaffIds.update((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  print(): void {
    window.print();
  }

  /** Page-break rules that depend on the chosen card-per-page layout. */
  readonly printConfigStyle = computed(() => {
    let pagingRule = '';
    if (this.cardsPerPage() === '1') {
      pagingRule = `
        .print-cards-container {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
        }
        .print-card-item {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          height: 100vh !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
      `;
    } else if (this.cardsPerPage() === '2') {
      pagingRule = `
        .print-cards-container {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 40px !important;
          width: 100% !important;
        }
        .print-card-item {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          display: flex !important;
          justify-content: center !important;
        }
        .print-card-item:nth-child(2n) {
          page-break-after: always !important;
          break-after: page !important;
        }
      `;
    } else {
      // Continuous grid: fits 2 cards side-by-side on a portrait page.
      pagingRule = `
        .print-cards-container {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 20px !important;
          width: 100% !important;
        }
        .print-card-item {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          display: flex !important;
          justify-content: center !important;
        }
      `;
    }

    return `
      @media print {
        @page {
          size: portrait !important;
          margin: 15mm 15mm 15mm 15mm !important;
        }
        body {
          background: white !important;
          color: black !important;
        }
        .no-print {
          display: none !important;
        }
        ${pagingRule}
      }
    `;
  });
}
