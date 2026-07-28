import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Assignment, RosterConfig, StaffMember, ThemeType } from '../models/types';
import { Icon } from '../ui/icon';
import { DailyAssignmentsPrintView } from './daily-assignments-print-view';
import { OnCallPrintView } from './on-call-print-view';
import { ShiftGrid } from './shift-grid';
import { StaffCardsView } from './staff-cards-view';

type ViewMode = 'table' | 'cards' | 'daily' | 'oncall';

@Component({
  selector: 'app-calendar-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ShiftGrid, StaffCardsView, DailyAssignmentsPrintView, OnCallPrintView],
  templateUrl: './calendar-view.html',
})
export class CalendarView {
  readonly staff = input.required<StaffMember[]>();
  readonly config = input.required<RosterConfig>();
  readonly assignments = input.required<Assignment[]>();
  readonly theme = input<ThemeType>('Professional');

  readonly exportCsv = output<void>();
  readonly configChange = output<RosterConfig>();

  readonly viewMode = signal<ViewMode>('table');
  readonly printedOn = new Date().toLocaleDateString();

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  onWardNameChange(value: string): void {
    this.configChange.emit({ ...this.config(), wardName: value });
  }

  print(): void {
    window.print();
  }
}
