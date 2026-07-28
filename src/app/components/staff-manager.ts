import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MONTHS } from '../constants';
import { RosterConfig, StaffMember, ThemeType, isHaStaff, pad2 } from '../models/types';
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
  readonly theme = input<ThemeType>('Professional');

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

  // ---- Theme-derived classes for the explanation panel ----

  readonly isNight = computed(() => this.theme() === 'Night');

  readonly panelBgClass = computed(() => {
    switch (this.theme()) {
      case 'Night':
        return 'bg-slate-800/40 border-slate-700/60';
      case 'Day':
        return 'bg-yellow-50 border-amber-200/80';
      case 'Colorful':
        return 'bg-emerald-50 border-emerald-200/80';
      case 'Attractive':
        return 'bg-indigo-50/50 border-indigo-100/80';
      default:
        return 'bg-slate-50 border-slate-200/80';
    }
  });

  readonly cardBgClass = computed(() =>
    this.isNight() ? 'bg-[#1a212d] border-slate-800' : 'bg-white border-slate-100',
  );

  readonly titleColor = computed(() => {
    switch (this.theme()) {
      case 'Night':
        return 'text-white';
      case 'Day':
        return 'text-amber-900';
      case 'Colorful':
        return 'text-emerald-900';
      case 'Attractive':
        return 'text-indigo-950';
      default:
        return 'text-slate-800';
    }
  });

  readonly descColor = computed(() => {
    switch (this.theme()) {
      case 'Night':
        return 'text-slate-400';
      case 'Day':
        return 'text-amber-800/80';
      case 'Colorful':
        return 'text-emerald-800/80';
      case 'Attractive':
        return 'text-indigo-900/80';
      default:
        return 'text-slate-600';
    }
  });

  readonly listColor = computed(() => {
    switch (this.theme()) {
      case 'Night':
        return 'text-slate-300';
      case 'Day':
        return 'text-amber-900/90';
      case 'Colorful':
        return 'text-emerald-900/90';
      case 'Attractive':
        return 'text-indigo-950/90';
      default:
        return 'text-slate-600';
    }
  });

  readonly iconBgRegular = computed(() =>
    this.isNight() ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600',
  );
  readonly iconBgHa = computed(() =>
    this.isNight() ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600',
  );
  readonly iconBgCp = computed(() =>
    this.isNight() ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-50 text-violet-600',
  );
  readonly codeClass = computed(() =>
    this.isNight() ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700',
  );
}
