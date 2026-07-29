import { Injectable, inject } from '@angular/core';
import { MONTHS } from '../constants';
import { Assignment, RosterConfig, ShiftType, StaffMember, pad2 } from '../models/types';
import { SupabaseService } from './supabase.service';

export interface Ward {
  id: string;
  name: string;
  head_id: string | null;
}

interface StaffRow {
  id: string;
  ward_id: string;
  code: string;
  name: string;
  is_senior: boolean;
  is_male: boolean;
  max_morning: number;
  max_evening: number;
  max_night: number;
  phone: string;
  is_counterpart: boolean;
  counterpart_of: string | null;
  counterpart_start: string | null;
  counterpart_end: string | null;
  sort_order: number;
}

export interface WardSnapshot {
  staff: StaffMember[];
  config: RosterConfig | null;
  assignments: Assignment[];
}

/**
 * Reads and writes ward-scoped roster data.
 *
 * The application identifies staff by their human code (S001); the database uses a
 * uuid. This service owns that mapping so the rest of the app is unaffected.
 */
@Injectable({ providedIn: 'root' })
export class RosterDataService {
  private readonly supabase = inject(SupabaseService);

  /** staff code -> database uuid, for the ward currently loaded. */
  private idByCode = new Map<string, string>();
  private codeById = new Map<string, string>();

  /** Inclusive date window the grid needs: three context days plus the month. */
  monthRange(year: number, month: string): { from: string; to: string } {
    const monthIdx = Math.max(0, MONTHS.indexOf(month));
    const first = new Date(year, monthIdx, 1);
    const from = new Date(first);
    from.setDate(from.getDate() - 3);
    const last = new Date(year, monthIdx + 1, 0);
    const fmt = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return { from: fmt(from), to: fmt(last) };
  }

  async listWards(): Promise<Ward[]> {
    const { data, error } = await this.supabase.client
      .from('wards')
      .select('id, name, head_id')
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []) as Ward[];
  }

  async createWard(name: string, headId: string | null): Promise<Ward> {
    const { data, error } = await this.supabase.client
      .from('wards')
      .insert({ name, head_id: headId })
      .select('id, name, head_id')
      .single();
    if (error) throw new Error(error.message);
    return data as Ward;
  }

  async updateWard(id: string, patch: { name?: string; head_id?: string | null }): Promise<void> {
    const { error } = await this.supabase.client.from('wards').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteWard(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('wards').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  /** Everything the roster screens need for one ward and one month. */
  async loadWard(wardId: string, year: number, month: string): Promise<WardSnapshot> {
    const { data: staffRows, error: staffError } = await this.supabase.client
      .from('staff')
      .select('*')
      .eq('ward_id', wardId)
      .order('sort_order')
      .order('code');
    if (staffError) throw new Error(staffError.message);

    const rows = (staffRows ?? []) as StaffRow[];
    this.idByCode = new Map(rows.map((r) => [r.code, r.id]));
    this.codeById = new Map(rows.map((r) => [r.id, r.code]));

    const staff: StaffMember[] = rows.map((r) => ({
      id: r.code,
      name: r.name,
      isSenior: r.is_senior,
      isMale: r.is_male,
      maxMorning: r.max_morning,
      maxEvening: r.max_evening,
      maxNight: r.max_night,
      phone: r.phone,
      isCounterPart: r.is_counterpart,
      counterPartOf: r.counterpart_of ? this.codeById.get(r.counterpart_of) : undefined,
      counterPartStart: r.counterpart_start ?? undefined,
      counterPartEnd: r.counterpart_end ?? undefined,
    }));

    const { data: configRow, error: configError } = await this.supabase.client
      .from('roster_configs')
      .select('settings')
      .eq('ward_id', wardId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    if (configError) throw new Error(configError.message);

    const { from, to } = this.monthRange(year, month);
    const { data: assignmentRows, error: assignmentError } = await this.supabase.client
      .from('assignments')
      .select('staff_id, duty_date, shift')
      .eq('ward_id', wardId)
      .gte('duty_date', from)
      .lte('duty_date', to);
    if (assignmentError) throw new Error(assignmentError.message);

    const assignments: Assignment[] = (assignmentRows ?? [])
      .map((a) => ({
        staffId: this.codeById.get(a.staff_id as string) ?? '',
        date: a.duty_date as string,
        shift: a.shift as ShiftType,
      }))
      .filter((a) => a.staffId);

    return {
      staff,
      config: (configRow?.settings as RosterConfig) ?? null,
      assignments,
    };
  }

  // ---------------------------------------------------------------- staff ----

  private toRow(wardId: string, member: StaffMember, sortOrder: number) {
    return {
      ward_id: wardId,
      code: member.id,
      name: member.name ?? '',
      is_senior: !!member.isSenior,
      is_male: !!member.isMale,
      max_morning: member.maxMorning ?? 0,
      max_evening: member.maxEvening ?? 0,
      max_night: member.maxNight ?? 0,
      phone: member.phone ?? '',
      is_counterpart: !!member.isCounterPart,
      counterpart_of: member.counterPartOf ? (this.idByCode.get(member.counterPartOf) ?? null) : null,
      counterpart_start: member.counterPartStart ?? null,
      counterpart_end: member.counterPartEnd ?? null,
      sort_order: sortOrder,
    };
  }

  async saveStaff(wardId: string, staff: StaffMember[]): Promise<void> {
    if (staff.length === 0) return;
    // Two passes so counterpart links can resolve against freshly inserted rows.
    const rows = staff.map((m, i) => this.toRow(wardId, m, i));
    const { data, error } = await this.supabase.client
      .from('staff')
      .upsert(rows, { onConflict: 'ward_id,code' })
      .select('id, code');
    if (error) throw new Error(error.message);

    for (const r of data ?? []) {
      this.idByCode.set(r.code as string, r.id as string);
      this.codeById.set(r.id as string, r.code as string);
    }

    const links = staff.filter((m) => m.isCounterPart && m.counterPartOf);
    if (links.length) {
      const relinked = links.map((m) => ({
        ward_id: wardId,
        code: m.id,
        counterpart_of: this.idByCode.get(m.counterPartOf!) ?? null,
      }));
      const { error: linkError } = await this.supabase.client
        .from('staff')
        .upsert(relinked, { onConflict: 'ward_id,code' });
      if (linkError) throw new Error(linkError.message);
    }
  }

  async renameStaffCode(wardId: string, oldCode: string, newCode: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('staff')
      .update({ code: newCode })
      .eq('ward_id', wardId)
      .eq('code', oldCode);
    if (error) throw new Error(error.message);

    const id = this.idByCode.get(oldCode);
    if (id) {
      this.idByCode.delete(oldCode);
      this.idByCode.set(newCode, id);
      this.codeById.set(id, newCode);
    }
  }

  async deleteStaff(wardId: string, codes: string[]): Promise<void> {
    if (!codes.length) return;
    const { error } = await this.supabase.client
      .from('staff')
      .delete()
      .eq('ward_id', wardId)
      .in('code', codes);
    if (error) throw new Error(error.message);

    for (const code of codes) {
      const id = this.idByCode.get(code);
      if (id) this.codeById.delete(id);
      this.idByCode.delete(code);
    }
  }

  // --------------------------------------------------------------- config ----

  async saveConfig(wardId: string, config: RosterConfig): Promise<void> {
    const { error } = await this.supabase.client.from('roster_configs').upsert(
      { ward_id: wardId, year: config.year, month: config.month, settings: config, updated_at: new Date().toISOString() },
      { onConflict: 'ward_id,year,month' },
    );
    if (error) throw new Error(error.message);
  }

  // ---------------------------------------------------------- assignments ----

  async setAssignments(wardId: string, updates: Assignment[]): Promise<void> {
    const removals = updates.filter((u) => u.shift === ShiftType.None);
    const writes = updates.filter((u) => u.shift !== ShiftType.None);

    for (const remove of removals) {
      const staffId = this.idByCode.get(remove.staffId);
      if (!staffId) continue;
      const { error } = await this.supabase.client
        .from('assignments')
        .delete()
        .eq('staff_id', staffId)
        .eq('duty_date', remove.date);
      if (error) throw new Error(error.message);
    }

    if (writes.length) {
      const rows = writes
        .map((a) => {
          const staffId = this.idByCode.get(a.staffId);
          return staffId ? { ward_id: wardId, staff_id: staffId, duty_date: a.date, shift: a.shift } : null;
        })
        .filter((r): r is NonNullable<typeof r> => !!r);

      if (rows.length) {
        const { error } = await this.supabase.client
          .from('assignments')
          .upsert(rows, { onConflict: 'staff_id,duty_date' });
        if (error) throw new Error(error.message);
      }
    }
  }

  /** Replaces a whole month, used after generating a roster. */
  async replaceMonth(wardId: string, year: number, month: string, assignments: Assignment[]): Promise<void> {
    const { from, to } = this.monthRange(year, month);
    const { error: deleteError } = await this.supabase.client
      .from('assignments')
      .delete()
      .eq('ward_id', wardId)
      .gte('duty_date', from)
      .lte('duty_date', to);
    if (deleteError) throw new Error(deleteError.message);

    await this.setAssignments(wardId, assignments);
  }
}
