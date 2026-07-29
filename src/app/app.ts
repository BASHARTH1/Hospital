import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { AdminConsole } from './components/admin-console';
import { AuthScreen } from './components/auth-screen';
import { CalendarView } from './components/calendar-view';
import { Generator } from './components/generator';
import { ManualEntry } from './components/manual-entry';
import { RulesManager } from './components/rules-manager';
import { StaffManager } from './components/staff-manager';
import { TabType } from './models/types';
import { AuthService } from './services/auth.service';
import { RosterStore } from './services/roster-store';
import { Icon, IconName } from './ui/icon';

interface TabDef {
  id: TabType;
  icon: IconName;
  label: string;
}

type Screen = 'loading' | 'auth' | 'admin' | 'wardPicker' | 'roster';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, AuthScreen, AdminConsole, StaffManager, RulesManager, ManualEntry, Generator, CalendarView],
  templateUrl: './app.html',
})
export class App {
  readonly store = inject(RosterStore);
  readonly auth = inject(AuthService);

  readonly tabs: TabDef[] = [
    { id: 'Staff', icon: 'Users', label: 'Staff' },
    { id: 'Rules', icon: 'Settings', label: 'Rules' },
    { id: 'Manual', icon: 'Edit', label: 'Manual' },
    { id: 'Generate', icon: 'Sparkles', label: 'Generate' },
    { id: 'Calendar', icon: 'CalendarIcon', label: 'Calendar' },
  ];

  readonly isDark = computed(() => this.store.theme() === 'Dark');

  readonly screen = computed<Screen>(() => {
    if (this.auth.initialising()) return 'loading';
    if (!this.auth.isSignedIn() || this.auth.mustChangePassword()) return 'auth';
    if (this.store.wardId()) return 'roster';
    return this.auth.isAdmin() ? 'admin' : 'wardPicker';
  });

  readonly contextLabel = computed(() => {
    const config = this.store.config();
    const ward = this.store.activeWard()?.name || config.wardName?.trim();
    return `${ward ? ward + ' · ' : ''}${config.month} ${config.year}`;
  });

  constructor() {
    // Load the wards this account can see, once signed in.
    effect(() => {
      if (this.auth.isSignedIn() && !this.auth.mustChangePassword()) {
        void this.store.refreshWards();
      }
    });

    // A head with exactly one ward goes straight into it.
    effect(() => {
      if (this.screen() !== 'wardPicker') return;
      const wards = this.store.wards();
      if (wards.length === 1) void this.store.openWard(wards[0].id);
    });
  }

  toggleTheme(): void {
    this.store.setTheme(this.isDark() ? 'Light' : 'Dark');
  }

  async signOut(): Promise<void> {
    this.store.closeWard();
    await this.auth.signOut();
  }

  backToWards(): void {
    this.store.closeWard();
  }
}
