import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Assignment, RosterConfig, StaffMember, ThemeType } from '../models/types';
import { Icon } from '../ui/icon';
import { ShiftGrid } from './shift-grid';

@Component({
  selector: 'app-manual-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ShiftGrid],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="text-xl font-semibold flex items-center gap-2 text-gray-800">
            <app-icon name="Edit" [size]="20" class="text-blue-500" />
            Manual Duty Entry
          </h2>
          <p class="text-sm text-gray-500">Edit individual shifts or import/export calendar templates</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <input type="file" #fileInput (change)="onFileChange($event)" accept=".csv" class="hidden" />
          <button
            type="button"
            (click)="fileInput.click()"
            class="flex items-center gap-2 px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition shadow-sm"
          >
            <app-icon name="Upload" [size]="16" /> Import Calendar CSV
          </button>
          <button
            type="button"
            (click)="exportCsv.emit()"
            class="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-600 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-50 transition shadow-sm"
          >
            <app-icon name="Download" [size]="16" /> Export Calendar Layout
          </button>
        </div>
      </div>

      <div
        class="flex gap-4 p-4 border rounded-xl"
        [class]="theme() === 'Attractive' ? 'bg-white/40 border-white' : 'border-gray-100 bg-gray-50/50'"
      >
        <div class="flex-1 max-w-[200px]">
          <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Month</label>
          <div class="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 shadow-sm">
            {{ config().month }}
          </div>
        </div>
        <div class="flex-1 max-w-[200px]">
          <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Year</label>
          <div class="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 shadow-sm">
            {{ config().year }}
          </div>
        </div>
      </div>

      <app-shift-grid
        [staff]="staff()"
        [config]="config()"
        [assignments]="assignments()"
        [theme]="theme()"
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
  readonly theme = input<ThemeType>('Professional');

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
