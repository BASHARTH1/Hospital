import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MONTHS } from '../constants';
import { RosterConfig, StaffMember, isHaStaff, pad2 } from '../models/types';
import { EditableIdInput } from '../ui/editable-id-input';
import { Icon } from '../ui/icon';

@Component({
  selector: 'app-staff-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, EditableIdInput],
  templateUrl: './staff-manager.html',
})
export class StaffManager {
  readonly staff = input.required<StaffMember[]>();
  readonly config = input.required<RosterConfig>();

  readonly add = output<void>();
  readonly addHa = output<void>();
  readonly addCounterPart = output<void>();
  readonly updateMember = output<{ id: string; updates: Partial<StaffMember> }>();
  readonly removeMultiple = output<string[]>();
  readonly exportCsv = output<void>();
  readonly importCsv = output<string>();

  private readonly selectedIds = signal<string[]>([]);

  readonly activeSelectedIds = computed(() =>
    this.selectedIds().filter((id) => this.staff().some((s) => s.id === id)),
  );

  readonly allSelected = computed(
    () => this.staff().length > 0 && this.activeSelectedIds().length === this.staff().length,
  );

  private readonly monthIdx = computed(() => {
    const idx = MONTHS.indexOf(this.config().month);
    return idx === -1 ? 0 : idx;
  });

  readonly daysInMonth = computed(() => new Date(this.config().year, this.monthIdx() + 1, 0).getDate());
  readonly dayNumbers = computed(() => Array.from({ length: this.daysInMonth() }, (_, i) => i + 1));
  readonly primaryStaff = computed(() => this.staff().filter((s) => !s.isCounterPart));

  /** Head-count split shown as summary chips above the table. */
  readonly counts = computed(() => {
    const staff = this.staff();
    const counterparts = staff.filter((s) => s.isCounterPart).length;
    const ha = staff.filter((s) => !s.isCounterPart && isHaStaff(s.name)).length;
    return { total: staff.length, regular: staff.length - counterparts - ha, ha, counterparts };
  });

  isHa(name: string): boolean {
    return isHaStaff(name);
  }

  isSelected(id: string): boolean {
    return this.activeSelectedIds().includes(id);
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedIds.set([]);
    } else {
      this.selectedIds.set(this.staff().map((s) => s.id));
    }
  }

  toggleSelection(id: string): void {
    this.selectedIds.update((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  onIdChange(change: { oldId: string; newId: string }): void {
    this.updateMember.emit({ id: change.oldId, updates: { id: change.newId } });
  }

  patch(id: string, updates: Partial<StaffMember>): void {
    this.updateMember.emit({ id, updates });
  }

  patchNumber(id: string, key: 'maxMorning' | 'maxEvening' | 'maxNight', raw: string): void {
    this.patch(id, { [key]: parseInt(raw) || 0 } as Partial<StaffMember>);
  }

  delete(ids: string[]): void {
    if (ids.length === 0) return;
    const msg = ids.length === 1 ? 'Delete this staff member?' : `Delete ${ids.length} selected staff members?`;
    if (window.confirm(msg)) {
      this.removeMultiple.emit(ids);
      this.selectedIds.update((prev) => prev.filter((id) => !ids.includes(id)));
    }
  }

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

  /** `custom` when a counterpart has an explicit date window, otherwise `month`. */
  periodMode(member: StaffMember): 'month' | 'custom' {
    return member.counterPartStart ? 'custom' : 'month';
  }

  onPeriodModeChange(member: StaffMember, mode: string): void {
    if (mode === 'month') {
      this.patch(member.id, { counterPartStart: undefined, counterPartEnd: undefined });
    } else {
      const m = pad2(this.monthIdx() + 1);
      this.patch(member.id, {
        counterPartStart: `${this.config().year}-${m}-01`,
        counterPartEnd: `${this.config().year}-${m}-${pad2(this.daysInMonth())}`,
      });
    }
  }

  counterPartDay(dateStr: string | undefined, fallback: number): number {
    if (!dateStr) return fallback;
    return parseInt(dateStr.split('-')[2]) || fallback;
  }

  onCounterPartDayChange(member: StaffMember, key: 'counterPartStart' | 'counterPartEnd', dayNum: string): void {
    const dateStr = `${this.config().year}-${pad2(this.monthIdx() + 1)}-${pad2(dayNum)}`;
    this.patch(member.id, { [key]: dateStr } as Partial<StaffMember>);
  }
}
