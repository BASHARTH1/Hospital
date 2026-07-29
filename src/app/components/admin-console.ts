import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService, Profile } from '../services/auth.service';
import { RosterDataService } from '../services/roster-data.service';
import { RosterStore } from '../services/roster-store';
import { SupabaseService } from '../services/supabase.service';
import { Icon } from '../ui/icon';

@Component({
  selector: 'app-admin-console',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './admin-console.html',
})
export class AdminConsole {
  readonly store = inject(RosterStore);
  private readonly data = inject(RosterDataService);
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  readonly heads = signal<Profile[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  // New ward form
  readonly newWardName = signal('');

  // New head form
  readonly newHeadName = signal('');
  readonly newHeadEmail = signal('');
  readonly newHeadPassword = signal('');
  readonly newHeadWard = signal('');

  readonly unassignedWards = computed(() => this.store.wards().filter((w) => !w.head_id));

  constructor() {
    void this.refresh();
  }

  headName(headId: string | null): string {
    if (!headId) return '';
    const head = this.heads().find((h) => h.id === headId);
    return head ? head.full_name || head.email : 'Unknown';
  }

  wardsOf(headId: string): string {
    return this.store
      .wards()
      .filter((w) => w.head_id === headId)
      .map((w) => w.name)
      .join(', ');
  }

  async refresh(): Promise<void> {
    this.error.set(null);
    try {
      await this.store.refreshWards();
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('id, email, full_name, role, must_change_password')
        .order('full_name');
      if (error) throw new Error(error.message);
      this.heads.set((data ?? []) as Profile[]);
    } catch (err) {
      this.error.set((err as Error).message);
    }
  }

  private async run(work: () => Promise<void>, successMessage?: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await work();
      if (successMessage) this.notice.set(successMessage);
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  // ---------------------------------------------------------------- wards ----

  createWard(event: Event): void {
    event.preventDefault();
    const name = this.newWardName().trim();
    if (!name) return;
    void this.run(async () => {
      await this.data.createWard(name, null);
      this.newWardName.set('');
      await this.refresh();
    }, `Ward "${name}" created.`);
  }

  renameWard(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    void this.run(async () => {
      await this.data.updateWard(id, { name: trimmed });
      await this.refresh();
    });
  }

  assignWard(wardId: string, headId: string): void {
    void this.run(async () => {
      await this.data.updateWard(wardId, { head_id: headId || null });
      await this.refresh();
    }, 'Ward assignment updated.');
  }

  deleteWard(id: string, name: string): void {
    if (!window.confirm(`Delete "${name}"? Its staff, rules and duties are deleted too.`)) return;
    void this.run(async () => {
      await this.data.deleteWard(id);
      await this.refresh();
    }, `Ward "${name}" deleted.`);
  }

  openWard(id: string): void {
    void this.store.openWard(id);
  }

  // ---------------------------------------------------------------- heads ----

  createHead(event: Event): void {
    event.preventDefault();
    const email = this.newHeadEmail().trim();
    const password = this.newHeadPassword();
    if (!email || password.length < 8) {
      this.error.set('Enter an email and a password of at least 8 characters.');
      return;
    }

    void this.run(async () => {
      const { error } = await this.auth.callAdminApi<{ id: string }>({
        action: 'create',
        email,
        password,
        fullName: this.newHeadName().trim(),
        wardId: this.newHeadWard() || null,
      });
      if (error) throw new Error(error);

      this.newHeadName.set('');
      this.newHeadEmail.set('');
      this.newHeadPassword.set('');
      this.newHeadWard.set('');
      await this.refresh();
    }, 'Account created. Give the person their email and temporary password — they will be asked to change it.');
  }

  resetPassword(head: Profile): void {
    const password = window.prompt(`New temporary password for ${head.email} (at least 8 characters):`);
    if (!password) return;
    if (password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }
    void this.run(async () => {
      const { error } = await this.auth.callAdminApi({ action: 'reset-password', userId: head.id, password });
      if (error) throw new Error(error);
      await this.refresh();
    }, `Password reset for ${head.email}. They will be asked to change it on next sign-in.`);
  }

  deleteHead(head: Profile): void {
    if (!window.confirm(`Delete the account for ${head.email}? Their wards stay, but become unassigned.`)) return;
    void this.run(async () => {
      const { error } = await this.auth.callAdminApi({ action: 'delete', userId: head.id });
      if (error) throw new Error(error);
      await this.refresh();
    }, 'Account deleted.');
  }

  generatePassword(): void {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    this.newHeadPassword.set(Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(''));
  }
}
