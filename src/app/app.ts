import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { THEMES } from './constants';
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
  readonly themes = THEMES;

  readonly tabs: TabDef[] = [
    { id: 'Staff', icon: 'Users', label: 'Staff' },
    { id: 'Rules', icon: 'Settings', label: 'Rules' },
    { id: 'Manual', icon: 'Edit', label: 'Manual' },
    { id: 'Generate', icon: 'Sparkles', label: 'Generate' },
    { id: 'Calendar', icon: 'CalendarIcon', label: 'Calendar' },
  ];

  private readonly theme = this.store.theme;

  readonly themeClasses = computed(
    () =>
      ({
        Professional: 'bg-gray-50 text-gray-900',
        Colorful: 'bg-emerald-50 text-gray-900',
        Attractive: 'bg-indigo-50/30 text-indigo-950',
        Day: 'bg-yellow-50 text-amber-900',
        Night: 'bg-[#0b0e14] text-slate-200',
      })[this.theme()],
  );

  readonly containerClasses = computed(
    () =>
      ({
        Professional: 'bg-white rounded-xl shadow-lg border border-gray-100 p-2 sm:p-6',
        Colorful: 'bg-white rounded-2xl shadow-xl border-2 border-emerald-100 p-2 sm:p-6',
        Attractive: 'bg-white/80 backdrop-blur-md rounded-[2.5rem] shadow-2xl border border-white p-2 sm:p-8',
        Day: 'bg-white rounded-3xl shadow-xl border-4 border-amber-100 p-2 sm:p-6',
        Night: 'bg-[#161b22] rounded-xl shadow-2xl border border-slate-700/50 p-2 sm:p-6',
      })[this.theme()],
  );

  readonly titleClass = computed(() => {
    switch (this.theme()) {
      case 'Attractive':
        return 'bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-fuchsia-600';
      case 'Night':
        return 'text-white';
      case 'Day':
        return 'text-amber-600';
      default:
        return '';
    }
  });

  readonly isNight = computed(() => this.theme() === 'Night');

  readonly navBarClass = computed(() => {
    switch (this.theme()) {
      case 'Attractive':
        return 'bg-indigo-100/50 rounded-3xl';
      case 'Night':
        return 'bg-slate-800 rounded-xl';
      case 'Day':
        return 'bg-amber-100/50 rounded-2xl';
      default:
        return 'bg-gray-200 rounded-lg';
    }
  });

  readonly tabShapeClass = computed(() => {
    switch (this.theme()) {
      case 'Attractive':
        return 'rounded-2xl';
      case 'Day':
        return 'rounded-xl';
      default:
        return 'rounded-md';
    }
  });

  readonly activeTabClass = computed(() => {
    switch (this.theme()) {
      case 'Attractive':
        return 'bg-white shadow-md text-indigo-600 font-black';
      case 'Night':
        return 'bg-slate-700 shadow-sm text-cyan-400 font-black';
      case 'Day':
        return 'bg-white shadow-sm text-amber-600 font-black';
      default:
        return 'bg-white shadow-sm text-blue-600 font-bold';
    }
  });

  readonly inactiveTabClass = computed(() =>
    this.isNight() ? 'text-slate-500 hover:bg-slate-700/50' : 'text-gray-600 hover:bg-gray-300/50',
  );
}
