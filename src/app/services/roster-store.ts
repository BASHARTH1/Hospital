import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { MONTHS } from '../constants';
import { Assignment, RosterConfig, ShiftType, StaffMember, TabType, ThemeType, pad2 } from '../models/types';
import { RosterDataService, Ward } from './roster-data.service';

const DEFAULT_CONFIG: RosterConfig = {
  year: new Date().getFullYear(),
  month: MONTHS[new Date().getMonth()],
  wardName: '',
  minMorning: 7,
  minEvening: 6,
  minNight: 6,
  minMorningWeekend: 7,
  minEveningWeekend: 6,
  minNightWeekend: 6,
  minMorningHoliday: 5,
  minEveningHoliday: 5,
  minNightHoliday: 5,
  holidays: [],
  minSenior: 2,
  maxMale: 2,
  maxConsecutiveEvening: 2,
  maxConsecutiveNight: 2,
  maxConsecutiveDuty: 5,
  offAfterNight: 2,
  haMinMorning: 2,
  haMinEvening: 2,
  haMinNight: 2,
  haMinMorningWeekend: 2,
  haMinEveningWeekend: 2,
  haMinNightWeekend: 2,
  haMinMorningHoliday: 1,
  haMinEveningHoliday: 1,
  haMinNightHoliday: 1,
  haMinSenior: 1,
  haMaxMale: 1,
  haMaxConsecutiveDuty: 5,
  haOffAfterNight: 2,
};

const THEME_STORAGE_KEY = 'roster_theme';

/** Remembered theme, else the operating system preference. */
function readStoredTheme(): ThemeType {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'Light' || saved === 'Dark') return saved;
  } catch {
    // Ignore and fall through to the system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light';
}

function downloadCsv(rows: (string | number)[][], filename: string): void {
  const csvContent = rows.map((e) => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Single source of truth for the roster screens, backed by Supabase.
 *
 * Every mutation updates the signals immediately and queues the matching database
 * write. Writes run through one serial chain so a staff insert always lands before
 * an assignment that references it.
 */
@Injectable({ providedIn: 'root' })
export class RosterStore {
  private readonly data = inject(RosterDataService);

  readonly activeTab = signal<TabType>('Staff');
  readonly staff = signal<StaffMember[]>([]);
  readonly config = signal<RosterConfig>(DEFAULT_CONFIG);
  readonly assignments = signal<Assignment[]>([]);
  readonly theme = signal<ThemeType>(readStoredTheme());

  readonly wards = signal<Ward[]>([]);
  readonly wardId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly syncError = signal<string | null>(null);

  readonly activeWard = computed(() => this.wards().find((w) => w.id === this.wardId()) ?? null);

  /** Serialises database writes and surfaces failures without losing the queue. */
  private queue: Promise<unknown> = Promise.resolve();
  private staffSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private configSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.classList.toggle('dark', theme === 'Dark');
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Storage can be unavailable (private mode); the theme still applies.
      }
    });

    window.addEventListener('beforeprint', () => document.documentElement.classList.remove('dark'));
    window.addEventListener('afterprint', () =>
      document.documentElement.classList.toggle('dark', this.theme() === 'Dark'),
    );
  }

  // ------------------------------------------------------------ plumbing ----

  private enqueue<T>(work: () => Promise<T>): Promise<T | undefined> {
    const next = this.queue.then(async () => {
      this.saving.set(true);
      try {
        return await work();
      } catch (err) {
        this.syncError.set((err as Error).message || 'Could not save to the server.');
        return undefined;
      } finally {
        this.saving.set(false);
      }
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  private scheduleStaffSave(): void {
    if (this.staffSaveTimer) clearTimeout(this.staffSaveTimer);
    this.staffSaveTimer = setTimeout(() => {
      this.staffSaveTimer = null;
      const ward = this.wardId();
      if (!ward) return;
      void this.enqueue(() => this.data.saveStaff(ward, this.staff()));
    }, 600);
  }

  /** Forces any pending staff write to run now, so later writes see those rows. */
  private flushStaff(): void {
    if (!this.staffSaveTimer) return;
    clearTimeout(this.staffSaveTimer);
    this.staffSaveTimer = null;
    const ward = this.wardId();
    if (ward) void this.enqueue(() => this.data.saveStaff(ward, this.staff()));
  }

  private scheduleConfigSave(): void {
    if (this.configSaveTimer) clearTimeout(this.configSaveTimer);
    this.configSaveTimer = setTimeout(() => {
      this.configSaveTimer = null;
      const ward = this.wardId();
      if (!ward) return;
      void this.enqueue(() => this.data.saveConfig(ward, this.config()));
    }, 800);
  }

  // --------------------------------------------------------------- wards ----

  async refreshWards(): Promise<void> {
    try {
      this.wards.set(await this.data.listWards());
    } catch (err) {
      this.syncError.set((err as Error).message);
    }
  }

  /** Loads a ward's staff, rules and duties for the currently selected month. */
  async openWard(wardId: string): Promise<void> {
    this.loading.set(true);
    this.syncError.set(null);
    try {
      const ward = this.wards().find((w) => w.id === wardId);
      const current = this.config();
      const snapshot = await this.data.loadWard(wardId, current.year, current.month);

      this.wardId.set(wardId);
      this.staff.set(snapshot.staff);
      this.assignments.set(snapshot.assignments);
      this.config.set({
        ...(snapshot.config ?? DEFAULT_CONFIG),
        year: snapshot.config?.year ?? current.year,
        month: snapshot.config?.month ?? current.month,
        wardName: ward?.name ?? snapshot.config?.wardName ?? '',
      });
      this.activeTab.set('Staff');
    } catch (err) {
      this.syncError.set((err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  closeWard(): void {
    this.wardId.set(null);
    this.staff.set([]);
    this.assignments.set([]);
    this.config.set(DEFAULT_CONFIG);
  }

  /** Re-reads rules and duties after the period changes. */
  private async reloadPeriod(): Promise<void> {
    const ward = this.wardId();
    if (!ward) return;
    this.loading.set(true);
    try {
      const current = this.config();
      const snapshot = await this.data.loadWard(ward, current.year, current.month);
      this.staff.set(snapshot.staff);
      this.assignments.set(snapshot.assignments);
      if (snapshot.config) {
        this.config.set({ ...snapshot.config, wardName: current.wardName });
      }
    } catch (err) {
      this.syncError.set((err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  // ------------------------------------------------------- derived state ----

  /** Assignments plus the mirrored duties of every counterpart staff member. */
  readonly resolvedAssignments = computed<Assignment[]>(() => {
    const assignments = this.assignments();
    const counterpartStaff = this.staff().filter((s) => s.isCounterPart && s.counterPartOf);
    if (counterpartStaff.length === 0) return assignments;

    const mirrored: Assignment[] = [];
    for (const s of counterpartStaff) {
      for (const ta of assignments.filter((a) => a.staffId === s.counterPartOf)) {
        const isInPeriod =
          (!s.counterPartStart || ta.date >= s.counterPartStart) &&
          (!s.counterPartEnd || ta.date <= s.counterPartEnd);
        if (isInPeriod) {
          mirrored.push({ staffId: s.id, date: ta.date, shift: ta.shift });
        }
      }
    }
    return [...assignments, ...mirrored];
  });

  readonly monthIdx = computed(() => {
    const idx = MONTHS.indexOf(this.config().month);
    return idx === -1 ? 0 : idx;
  });

  readonly daysInMonth = computed(() => new Date(this.config().year, this.monthIdx() + 1, 0).getDate());

  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  setTheme(theme: ThemeType): void {
    this.theme.set(theme);
  }

  setConfig(config: RosterConfig): void {
    const previous = this.config();
    this.config.set(config);

    // Renaming the ward here keeps the sidebar and the roster header in step.
    if (config.wardName !== previous.wardName && this.wardId()) {
      const ward = this.wardId()!;
      const name = (config.wardName ?? '').trim();
      if (name) {
        void this.enqueue(async () => {
          await this.data.updateWard(ward, { name });
          await this.refreshWards();
        });
      }
    }

    if (config.year !== previous.year || config.month !== previous.month) {
      void this.reloadPeriod();
      return;
    }
    this.scheduleConfigSave();
  }

  // --------------------------------------------------------------- staff ----

  private nextStaffId(current: StaffMember[]): string {
    const nextIdNum =
      current.length > 0 ? Math.max(...current.map((s) => parseInt(s.id.replace(/\D/g, '') || '0'))) + 1 : 1;
    return `S${nextIdNum.toString().padStart(3, '0')}`;
  }

  addStaff(): void {
    this.staff.update((prev) => [
      ...prev,
      {
        id: this.nextStaffId(prev),
        name: '',
        isSenior: false,
        isMale: false,
        maxMorning: 15,
        maxEvening: 10,
        maxNight: 8,
        phone: '',
      },
    ]);
    this.scheduleStaffSave();
  }

  addHaStaff(): void {
    this.staff.update((prev) => [
      ...prev,
      {
        id: this.nextStaffId(prev),
        name: '(HA) ',
        isSenior: false,
        isMale: false,
        maxMorning: 15,
        maxEvening: 10,
        maxNight: 8,
        phone: '',
      },
    ]);
    this.scheduleStaffSave();
  }

  addCounterPartStaff(): void {
    this.staff.update((prev) => {
      const firstNonCounterPart = prev.find((s) => !s.isCounterPart);
      return [
        ...prev,
        {
          id: this.nextStaffId(prev),
          name: 'Counterpart Staff',
          isSenior: false,
          isMale: false,
          maxMorning: 0,
          maxEvening: 0,
          maxNight: 0,
          phone: '',
          isCounterPart: true,
          counterPartOf: firstNonCounterPart ? firstNonCounterPart.id : '',
        },
      ];
    });
    this.scheduleStaffSave();
  }

  updateStaff(id: string, updates: Partial<StaffMember>): void {
    if (updates.id !== undefined && updates.id !== id) {
      const cleanNewId = updates.id.trim();
      if (!cleanNewId) {
        alert('ID cannot be empty.');
        return;
      }
      if (this.staff().some((s) => s.id === cleanNewId)) {
        alert(`ID "${cleanNewId}" is already taken by another staff member.`);
        return;
      }

      this.staff.update((prev) =>
        prev.map((s) => {
          const sUpdates = s.id === id ? { ...updates, id: cleanNewId } : {};
          const newObj: StaffMember = { ...s, ...sUpdates };
          if (s.counterPartOf === id) newObj.counterPartOf = cleanNewId;
          return newObj;
        }),
      );
      this.assignments.update((prev) => prev.map((a) => (a.staffId === id ? { ...a, staffId: cleanNewId } : a)));

      const ward = this.wardId();
      if (ward) {
        this.flushStaff();
        void this.enqueue(() => this.data.renameStaffCode(ward, id, cleanNewId));
      }
      this.scheduleStaffSave();
      return;
    }

    this.staff.update((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    this.scheduleStaffSave();
  }

  removeMultipleStaff(ids: string[]): void {
    this.staff.update((prev) => prev.filter((s) => !ids.includes(s.id)));
    this.assignments.update((prev) => prev.filter((a) => !ids.includes(a.staffId)));

    const ward = this.wardId();
    if (ward) {
      this.flushStaff();
      void this.enqueue(() => this.data.deleteStaff(ward, ids));
    }
  }

  // --------------------------------------------------------- assignments ----

  updateAssignment(staffId: string, date: string, shift: ShiftType): void {
    this.assignments.update((prev) => {
      const filtered = prev.filter((a) => !(a.staffId === staffId && a.date === date));
      if (shift === ShiftType.None) return filtered;
      return [...filtered, { staffId, date, shift }];
    });

    const ward = this.wardId();
    if (ward) {
      this.flushStaff();
      void this.enqueue(() => this.data.setAssignments(ward, [{ staffId, date, shift }]));
    }
  }

  updateAssignmentsBatch(updates: Assignment[]): void {
    this.assignments.update((prev) => {
      const map = new Map<string, ShiftType>();
      prev.forEach((a) => map.set(`${a.staffId}|${a.date}`, a.shift));

      updates.forEach((u) => {
        if (u.shift === ShiftType.None) map.delete(`${u.staffId}|${u.date}`);
        else map.set(`${u.staffId}|${u.date}`, u.shift);
      });

      const result: Assignment[] = [];
      map.forEach((shift, key) => {
        const [staffId, date] = key.split('|');
        result.push({ staffId, date, shift });
      });
      return result;
    });

    const ward = this.wardId();
    if (ward) {
      this.flushStaff();
      void this.enqueue(() => this.data.setAssignments(ward, updates));
    }
  }

  /** Replaces the visible month, used after generating a roster. */
  setAssignments(assignments: Assignment[]): void {
    this.assignments.set(assignments);

    const ward = this.wardId();
    if (ward) {
      const { year, month } = this.config();
      this.flushStaff();
      void this.enqueue(() => this.data.replaceMonth(ward, year, month, assignments));
    }
  }

  // ----------------------------------------------------------------- csv ----

  exportStaff(): void {
    const headers = ['id', 'name', 'isSenior', 'isMale', 'maxMorning', 'maxEvening', 'maxNight', 'phone'];
    const rows = this.staff().map((s) => [
      s.id,
      s.name.replace(/,/g, ''),
      s.isSenior ? 'true' : 'false',
      s.isMale ? 'true' : 'false',
      s.maxMorning,
      s.maxEvening,
      s.maxNight,
      (s.phone || '').replace(/,/g, ''),
    ]);
    downloadCsv([headers, ...rows], 'staff_list.csv');
  }

  importStaff(csvData: string): void {
    const lines = csvData.split(/\r?\n/);
    if (lines.length < 2) return;
    const parseBool = (val: string) => {
      const s = (val || '').trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes';
    };
    const importedStaff: StaffMember[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length < 7) continue;
      const [id, name, isSenior, isMale, maxMorning, maxEvening, maxNight, phone] = parts;
      importedStaff.push({
        id: (id || '').trim(),
        name: (name || '').trim(),
        isSenior: parseBool(isSenior),
        isMale: parseBool(isMale),
        maxMorning: parseInt(maxMorning) || 0,
        maxEvening: parseInt(maxEvening) || 0,
        maxNight: parseInt(maxNight) || 0,
        phone: phone ? phone.trim() : '',
      });
    }
    if (importedStaff.length === 0) return;

    const removed = this.staff().filter((s) => !importedStaff.some((n) => n.id === s.id)).map((s) => s.id);
    this.staff.set(importedStaff);

    const ward = this.wardId();
    if (ward) {
      void this.enqueue(async () => {
        if (removed.length) await this.data.deleteStaff(ward, removed);
        await this.data.saveStaff(ward, importedStaff);
      });
    }
    alert(`Successfully imported ${importedStaff.length} staff members.`);
  }

  exportAssignments(): void {
    const config = this.config();
    const monthIdx = MONTHS.indexOf(config.month);
    const daysInMonth = new Date(config.year, monthIdx + 1, 0).getDate();
    const resolved = this.resolvedAssignments();

    const headers = ['ID', 'Name', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())];
    const rows = this.staff().map((member) => {
      const row: (string | number)[] = [member.id, member.name.replace(/,/g, '')];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${config.year}-${pad2(monthIdx + 1)}-${pad2(day)}`;
        const assignment = resolved.find((a) => a.staffId === member.id && a.date === dateStr);
        row.push(assignment ? assignment.shift : ShiftType.None);
      }
      return row;
    });

    downloadCsv([headers, ...rows], `duty_roster_${config.month}_${config.year}.csv`);
  }

  importAssignments(csvData: string): void {
    const config = this.config();
    const lines = csvData.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return;
    const header = lines[0].split(',');
    const imported: Assignment[] = [];
    const monthIdx = MONTHS.indexOf(config.month);

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      const staffId = parts[0].trim();
      if (!staffId) continue;
      for (let colIdx = 2; colIdx < header.length; colIdx++) {
        const dayNum = parseInt(header[colIdx]);
        if (isNaN(dayNum)) continue;
        const shift = parts[colIdx]?.trim() as ShiftType;
        if (shift && shift !== ShiftType.None) {
          imported.push({ staffId, date: `${config.year}-${pad2(monthIdx + 1)}-${pad2(dayNum)}`, shift });
        }
      }
    }

    if (imported.length === 0) return;
    this.setAssignments(imported);
    alert(`Successfully imported ${imported.length} shift assignments for ${config.month}.`);
  }
}
