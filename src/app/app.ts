import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CalendarView } from './components/calendar-view';
import { Generator } from './components/generator';
import { ManualEntry } from './components/manual-entry';
import { RulesManager } from './components/rules-manager';
import { StaffManager } from './components/staff-manager';
import { TabType } from './models/types';
import { RosterStore } from './services/roster-store';
import { Icon, IconName } from './ui/icon';

interface TabDef {
  id: TabType;
  icon: IconName;
  label: string;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, StaffManager, RulesManager, ManualEntry, Generator, CalendarView],
  templateUrl: './app.html',
})
export class App {
  readonly store = inject(RosterStore);

  readonly tabs: TabDef[] = [
    { id: 'Staff', icon: 'Users', label: 'Staff' },
    { id: 'Rules', icon: 'Settings', label: 'Rules' },
    { id: 'Manual', icon: 'Edit', label: 'Manual' },
    { id: 'Generate', icon: 'Sparkles', label: 'Generate' },
    { id: 'Calendar', icon: 'CalendarIcon', label: 'Calendar' },
  ];

  readonly isDark = computed(() => this.store.theme() === 'Dark');

  /** Ward and period, shown next to the product name for context. */
  readonly contextLabel = computed(() => {
    const config = this.store.config();
    const ward = config.wardName?.trim();
    return `${ward ? ward + ' · ' : ''}${config.month} ${config.year}`;
  });

  toggleTheme(): void {
    this.store.setTheme(this.isDark() ? 'Light' : 'Dark');
  }
}
