import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Icon } from '../ui/icon';

/** Sign-in, plus the forced password change on a newly issued account. */
@Component({
  selector: 'app-auth-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div class="w-full max-w-sm">
        <div class="mb-6 flex items-center justify-center gap-2.5">
          <span class="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white shadow-sm">
            <app-icon name="Activity" [size]="20" />
          </span>
          <span class="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Roster Manager
          </span>
        </div>

        <div class="card p-6">
          @if (mode() === 'signIn') {
            <h1 class="text-base font-semibold text-slate-900 dark:text-slate-100">Sign in</h1>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Use the account details provided by your administrator.
            </p>

            <form class="mt-5 space-y-4" (submit)="submitSignIn($event)">
              <div>
                <label for="email" class="label">Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autocomplete="username"
                  required
                  [value]="email()"
                  (input)="email.set($any($event.target).value)"
                  class="input"
                  placeholder="you@hospital.org"
                />
              </div>
              <div>
                <label for="password" class="label">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  autocomplete="current-password"
                  required
                  [value]="password()"
                  (input)="password.set($any($event.target).value)"
                  class="input"
                />
              </div>

              @if (auth.error(); as message) {
                <p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700
                  dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  {{ message }}
                </p>
              }

              <button type="submit" class="btn-primary w-full" [disabled]="auth.signingIn()">
                @if (auth.signingIn()) {
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                  Signing in…
                } @else {
                  Sign in
                }
              </button>
            </form>
          } @else {
            <h1 class="text-base font-semibold text-slate-900 dark:text-slate-100">Choose a new password</h1>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your account uses a temporary password. Set your own before continuing.
            </p>

            <form class="mt-5 space-y-4" (submit)="submitPassword($event)">
              <div>
                <label for="new-password" class="label">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autocomplete="new-password"
                  required
                  [value]="newPassword()"
                  (input)="newPassword.set($any($event.target).value)"
                  class="input"
                />
                <p class="mt-1 text-[11px] text-slate-400 dark:text-slate-500">At least 8 characters.</p>
              </div>
              <div>
                <label for="confirm-password" class="label">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autocomplete="new-password"
                  required
                  [value]="confirmPassword()"
                  (input)="confirmPassword.set($any($event.target).value)"
                  class="input"
                />
              </div>

              @if (passwordError(); as message) {
                <p class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700
                  dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  {{ message }}
                </p>
              }

              <button type="submit" class="btn-primary w-full" [disabled]="savingPassword()">
                {{ savingPassword() ? 'Saving…' : 'Set password and continue' }}
              </button>
              <button type="button" class="btn-ghost w-full" (click)="auth.signOut()">Sign out</button>
            </form>
          }
        </div>
      </div>
    </div>
  `,
})
export class AuthScreen {
  readonly auth = inject(AuthService);

  readonly email = signal('');
  readonly password = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly passwordError = signal<string | null>(null);
  readonly savingPassword = signal(false);

  readonly mode = computed(() =>
    this.auth.isSignedIn() && this.auth.mustChangePassword() ? 'changePassword' : 'signIn',
  );

  async submitSignIn(event: Event): Promise<void> {
    event.preventDefault();
    await this.auth.signIn(this.email(), this.password());
    this.password.set('');
  }

  async submitPassword(event: Event): Promise<void> {
    event.preventDefault();
    this.passwordError.set(null);

    if (this.newPassword().length < 8) {
      this.passwordError.set('Password must be at least 8 characters.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('The two passwords do not match.');
      return;
    }

    this.savingPassword.set(true);
    try {
      const error = await this.auth.changePassword(this.newPassword());
      if (error) {
        this.passwordError.set(error);
        return;
      }
      this.newPassword.set('');
      this.confirmPassword.set('');
    } finally {
      this.savingPassword.set(false);
    }
  }
}
