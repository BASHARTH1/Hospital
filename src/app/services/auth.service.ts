import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export type UserRole = 'admin' | 'head';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  must_change_password: boolean;
}

/** Authentication state and the signed-in user's profile. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  /** True until the initial session lookup finishes, so the shell can hold back. */
  readonly initialising = signal(true);
  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly signingIn = signal(false);
  readonly error = signal<string | null>(null);

  readonly isSignedIn = computed(() => !!this.session() && !!this.profile());
  readonly isAdmin = computed(() => this.profile()?.role === 'admin');
  readonly mustChangePassword = computed(() => this.profile()?.must_change_password === true);
  readonly displayName = computed(() => {
    const profile = this.profile();
    return profile?.full_name?.trim() || profile?.email || '';
  });

  constructor() {
    void this.restore();

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      if (!session) {
        this.profile.set(null);
      }
    });
  }

  private async restore(): Promise<void> {
    try {
      const { data } = await this.supabase.client.auth.getSession();
      this.session.set(data.session);
      if (data.session) await this.loadProfile();
    } finally {
      this.initialising.set(false);
    }
  }

  /** Reads the caller's own profile row; RLS restricts this to themselves. */
  async loadProfile(): Promise<void> {
    const userId = this.session()?.user?.id;
    if (!userId) return;

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, email, full_name, role, must_change_password')
      .eq('id', userId)
      .single();

    if (error) {
      this.error.set(`Signed in, but your profile could not be loaded: ${error.message}`);
      this.profile.set(null);
      return;
    }
    this.profile.set(data as Profile);
  }

  async signIn(email: string, password: string): Promise<boolean> {
    this.signingIn.set(true);
    this.error.set(null);
    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        this.error.set(
          error.message === 'Invalid login credentials'
            ? 'That email and password do not match an account.'
            : error.message,
        );
        return false;
      }
      this.session.set(data.session);
      await this.loadProfile();
      return true;
    } finally {
      this.signingIn.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
  }

  /** Sets a new password and clears the forced-change flag. */
  async changePassword(newPassword: string): Promise<string | null> {
    const { error } = await this.supabase.client.auth.updateUser({ password: newPassword });
    if (error) return error.message;

    const userId = this.session()?.user?.id;
    if (userId) {
      await this.supabase.client.from('profiles').update({ must_change_password: false }).eq('id', userId);
      await this.loadProfile();
    }
    return null;
  }

  /** Calls the admin-only serverless endpoint with the caller's access token. */
  async callAdminApi<T>(body: unknown): Promise<{ data?: T; error?: string }> {
    const token = this.session()?.access_token;
    if (!token) return { error: 'Not signed in.' };

    try {
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return { error: payload.error || `Request failed (${res.status}).` };
      return { data: payload as T };
    } catch (err) {
      return { error: (err as Error).message || 'Network error.' };
    }
  }
}
