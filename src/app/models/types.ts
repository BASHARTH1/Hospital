export enum ShiftType {
  Morning = '1',
  Evening = '2',
  Night = '3',
  Off = 'W',
  Leave = 'L',
  PublicHoliday = 'H',
  MorningSpecial = '1S',
  MorningOnCall = 'O1',
  EveningOnCall = 'O2',
  NightOnCall = 'O3',
  RequestedMorning = 'R1',
  RequestedEvening = 'R2',
  RequestedNight = 'R3',
  RequestedOff = 'RW',
  None = '-',
}

export interface StaffMember {
  id: string;
  name: string;
  isSenior: boolean;
  isMale: boolean;
  maxMorning: number;
  maxEvening: number;
  maxNight: number;
  phone?: string;
  isCounterPart?: boolean;
  counterPartOf?: string;
  counterPartStart?: string;
  counterPartEnd?: string;
}

export interface RosterConfig {
  year: number;
  month: string;
  wardName?: string;
  minMorning: number;
  minEvening: number;
  minNight: number;
  minMorningWeekend: number;
  minEveningWeekend: number;
  minNightWeekend: number;
  minMorningHoliday?: number;
  minEveningHoliday?: number;
  minNightHoliday?: number;
  holidays?: string[]; // Date strings like "YYYY-MM-DD"
  minSenior: number;
  maxMale: number;
  maxConsecutiveEvening: number;
  maxConsecutiveNight: number;
  maxConsecutiveDuty: number;
  offAfterNight: number;
  haMinMorning?: number;
  haMinEvening?: number;
  haMinNight?: number;
  haMinMorningWeekend?: number;
  haMinEveningWeekend?: number;
  haMinNightWeekend?: number;
  haMinMorningHoliday?: number;
  haMinEveningHoliday?: number;
  haMinNightHoliday?: number;
  haMinSenior?: number;
  haMaxMale?: number;
  haMaxConsecutiveDuty?: number;
  haOffAfterNight?: number;
}

export interface Assignment {
  staffId: string;
  date: string; // YYYY-MM-DD
  shift: ShiftType;
}

export type TabType = 'Staff' | 'Rules' | 'Manual' | 'Generate' | 'Calendar';
export type ThemeType = 'Professional' | 'Colorful' | 'Attractive' | 'Day' | 'Night';

/** Names starting with `HA` or `(HA)` are auxiliary Hospital Assistants. */
export function isHaStaff(name: string): boolean {
  const trimmed = (name || '').trim();
  return trimmed.startsWith('HA') || trimmed.startsWith('(HA)');
}

export function pad2(n: number | string): string {
  return n.toString().padStart(2, '0');
}

export function toDateStr(year: number, monthIdx: number, day: number): string {
  return `${year}-${pad2(monthIdx + 1)}-${pad2(day)}`;
}
