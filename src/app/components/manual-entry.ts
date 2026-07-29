import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Assignment, RosterConfig, StaffMember } from '../models/types';
import { Icon } from '../ui/icon';
import { ShiftGrid } from './shift-grid';

@Component({
  selector: 'app-manual-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ShiftGrid],
  template: `
    <div class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Manual duty entry</h1>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Click any cell to set a shift for {{ config().month }} {{ config().year }}. Manual entries are kept as
            fixed anchors when a roster is generated.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <input type="file" #fileInput (change)="onFileChange($event)" accept=".csv" class="hidden" />
          <button type="button" (click)="fileInput.click()" class="btn-secondary">
            <app-icon name="Upload" [size]="15" /> Import CSV
          </button>
          <button type="button" (click)="exportCsv.emit()" class="btn-secondary">
            <app-icon name="Download" [size]="15" /> Export CSV
          </button>
        </div>
      </div>

      <app-shift-grid
        [staff]="staff()"
        [config]="config()"
        [assignments]="assignments()"
        (update)="updateAssignment.emit($event)"
        (updateBatch)="updateBatch.emit($event)"
      />
    </div>
  `,
})
export class ManualEntry {
  readonly staff = input.required<StaffMember[]>();
  readonly config = input.required<RosterConfig>();
  readonly assignments = input.required<Assignment[]>();

  readonly updateAssignment = output<Assignment>();
  readonly updateBatch = output<Assignment[]>();
  readonly exportCsv = output<void>();
  readonly importCsv = output<string>();

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.importCsv.emit(e.target?.result as string);
      input.value = '';
    };
    reader.readAsText(file);
  }
}
