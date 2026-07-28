import { Injectable, computed, signal } from '@angular/core';
import { MONTHS } from '../constants';
import { Assignment, RosterConfig, ShiftType, StaffMember, TabType, ThemeType, pad2 } from '../models/types';

const INITIAL_STAFF: StaffMember[] = [
  { id: 'S001', name: 'skldf', isSenior: true, isMale: false, maxMorning: 15, maxEvening: 10, maxNight: 8, phone: '555-0101' },
  { id: 'S002', name: 'jkjyy', isSenior: true, isMale: true, maxMorning: 15, maxEvening: 10, maxNight: 8, phone: '555-0102' },
  { id: 'S003', name: 'hgfhgj', isSenior: true, isMale: false, maxMorning: 15, maxEvening: 10, maxNight: 8, phone: '555-0103' },
  { id: 'S004', name: 'jghjj', isSenior: false, isMale: true, maxMorning: 15, maxEvening: 10, maxNight: 8, phone: '555-0104' },
];

const INITIAL_CONFIG: RosterConfig = {
  year: 2025,
  month: 'December',
  wardName: 'ICU',
  minMorning: 7,
  minEvening: 6,
  minNight: 6,
  minMorningWeekend: 7,
  minEveningWeekend: 6,
  minNightWeekend: 6,
  minMorningHoliday: 5,
  minEveningHoliday: 5,
  minNightHoliday: 5,
  holidays: ['2025-12-25', '2025-12-31'], // Christmas and New Year's Eve as default holidays
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
 * Single source of truth for the whole roster app — the Angular equivalent of the
 * `useState` cluster that lived in the React `App` component.
 */
@Injectable({ providedIn: 'root' })
export class RosterStore {
  readonly activeTab = signal<TabType>('Staff');
  readonly staff = signal<StaffMember[]>(INITIAL_STAFF);
  readonly config = signal<RosterConfig>(INITIAL_CONFIG);
  readonly assignments = signal<Assignment[]>([]);
  readonly theme = signal<ThemeType>('Professional');

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
    this.config.set(config);
  }

  private nextStaffId(current: StaffMember[]): string {
    const nextIdNum =
      current.length > 0
        ? Math.max(...current.map((s) => parseInt(s.id.replace(/\D/g, '') || '0'))) + 1
        : 1;
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

      // Update the staff ID, any other updates, and every counterpart pointer.
      this.staff.update((prev) =>
        prev.map((s) => {
          const sUpdates = s.id === id ? { ...updates, id: cleanNewId } : {};
          const newObj: StaffMember = { ...s, ...sUpdates };
          if (s.counterPartOf === id) {
            newObj.counterPartOf = cleanNewId;
          }
          return newObj;
        }),
      );

      this.assignments.update((prev) =>
        prev.map((a) => (a.staffId === id ? { ...a, staffId: cleanNewId } : a)),
      );
      return;
    }

    this.staff.update((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  removeMultipleStaff(ids: string[]): void {
    this.staff.update((prev) => prev.filter((s) => !ids.includes(s.id)));
    this.assignments.update((prev) => prev.filter((a) => !ids.includes(a.staffId)));
  }

  updateAssignment(staffId: string, date: string, shift: ShiftType): void {
    this.assignments.update((prev) => {
      const filtered = prev.filter((a) => !(a.staffId === staffId && a.date === date));
      if (shift === ShiftType.None) return filtered;
      return [...filtered, { staffId, date, shift }];
    });
  }

  updateAssignmentsBatch(updates: Assignment[]): void {
    this.assignments.update((prev) => {
      const map = new Map<string, ShiftType>();
      prev.forEach((a) => map.set(`${a.staffId}|${a.date}`, a.shift));

      updates.forEach((u) => {
        if (u.shift === ShiftType.None) {
          map.delete(`${u.staffId}|${u.date}`);
        } else {
          map.set(`${u.staffId}|${u.date}`, u.shift);
        }
      });

      const result: Assignment[] = [];
      map.forEach((shift, key) => {
        const [staffId, date] = key.split('|');
        result.push({ staffId, date, shift });
      });
      return result;
    });
  }

  setAssignments(assignments: Assignment[]): void {
    this.assignments.set(assignments);
  }

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
    if (importedStaff.length > 0) {
      this.staff.set(importedStaff);
      alert(`Successfully imported ${importedStaff.length} staff members.`);
    }
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

    if (imported.length > 0) {
      this.assignments.update((prev) => {
        const otherMonths = prev.filter((a) => {
          const d = new Date(a.date);
          return d.getMonth() !== monthIdx || d.getFullYear() !== config.year;
        });
        return [...otherMonths, ...imported];
      });
      alert(`Successfully imported ${imported.length} shift assignments for ${config.month}.`);
    }
  }
}
