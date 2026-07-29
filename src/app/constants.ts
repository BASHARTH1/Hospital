import { ShiftType, ThemeType } from './models/types';

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const YEARS = [2024, 2025, 2026, 2027];

export interface ShiftStyle {
  /** Short name shown in the legend. */
  label: string;
  /** Longer description shown on hover. */
  description: string;
  /** Background + border utilities, including their dark-mode variants. */
  bg: string;
  /** Foreground utilities, including their dark-mode variants. */
  color: string;
}

/**
 * One palette for every shift code, with dark-mode variants baked in.
 *
 * The grid is dense — 31+ columns of 10px type — so shifts read as tinted chips with
 * dark text rather than saturated blocks: easier to scan, and it prints legibly.
 * Hue carries the meaning: sky = morning, violet = evening, slate = night,
 * rose = leave, amber = holiday. On-call codes are outlined rather than filled.
 */
export const SHIFT_STYLES: Record<ShiftType, ShiftStyle> = {
  [ShiftType.Morning]: {
    label: 'Morning',
    description: 'Morning shift',
    bg: 'bg-sky-100 dark:bg-sky-500/20',
    color: 'text-sky-900 dark:text-sky-200',
  },
  [ShiftType.Evening]: {
    label: 'Evening',
    description: 'Evening shift',
    bg: 'bg-violet-100 dark:bg-violet-500/20',
    color: 'text-violet-900 dark:text-violet-200',
  },
  [ShiftType.Night]: {
    label: 'Night',
    description: 'Night shift',
    bg: 'bg-slate-700 dark:bg-slate-600',
    color: 'text-white dark:text-slate-50',
  },
  [ShiftType.Off]: {
    label: 'Off',
    description: 'Rest day',
    bg: 'bg-white dark:bg-slate-900',
    color: 'text-slate-300 dark:text-slate-600',
  },
  [ShiftType.Leave]: {
    label: 'Leave',
    description: 'Annual leave',
    bg: 'bg-rose-100 dark:bg-rose-500/20',
    color: 'text-rose-700 dark:text-rose-300',
  },
  [ShiftType.PublicHoliday]: {
    label: 'Holiday',
    description: 'Public holiday',
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    color: 'text-amber-800 dark:text-amber-300',
  },
  [ShiftType.MorningSpecial]: {
    label: 'M-Special',
    description: 'Morning — workshop / special assignment',
    bg: 'bg-sky-200 dark:bg-sky-500/35',
    color: 'text-sky-950 dark:text-sky-100',
  },
  [ShiftType.MorningOnCall]: {
    label: 'M-OnCall',
    description: 'Morning on-call',
    bg: 'bg-sky-50 ring-1 ring-inset ring-sky-400 dark:bg-sky-500/10 dark:ring-sky-500/60',
    color: 'text-sky-700 dark:text-sky-300',
  },
  [ShiftType.EveningOnCall]: {
    label: 'E-OnCall',
    description: 'Evening on-call',
    bg: 'bg-violet-50 ring-1 ring-inset ring-violet-400 dark:bg-violet-500/10 dark:ring-violet-500/60',
    color: 'text-violet-700 dark:text-violet-300',
  },
  [ShiftType.NightOnCall]: {
    label: 'N-OnCall',
    description: 'Night on-call',
    bg: 'bg-slate-100 ring-1 ring-inset ring-slate-500 dark:bg-slate-700/40 dark:ring-slate-500',
    color: 'text-slate-700 dark:text-slate-200',
  },
  // Requested codes reuse their base colour. The red "requested" ring is added by the
  // template so exactly one ring utility ever lands on the element.
  [ShiftType.RequestedMorning]: {
    label: 'Req M',
    description: 'Requested morning — fixed',
    bg: 'bg-sky-100 dark:bg-sky-500/20',
    color: 'text-sky-900 dark:text-sky-200',
  },
  [ShiftType.RequestedEvening]: {
    label: 'Req E',
    description: 'Requested evening — fixed',
    bg: 'bg-violet-100 dark:bg-violet-500/20',
    color: 'text-violet-900 dark:text-violet-200',
  },
  [ShiftType.RequestedNight]: {
    label: 'Req N',
    description: 'Requested night — fixed',
    bg: 'bg-slate-700 dark:bg-slate-600',
    color: 'text-white dark:text-slate-50',
  },
  [ShiftType.RequestedOff]: {
    label: 'Req Off',
    description: 'Requested rest day — fixed',
    bg: 'bg-slate-100 dark:bg-slate-800',
    color: 'text-slate-500 dark:text-slate-400',
  },
  [ShiftType.None]: {
    label: 'None',
    description: 'No duty assigned',
    bg: 'bg-transparent',
    color: 'text-slate-300 dark:text-slate-700',
  },
};

/** Every shift code, in the order they appear in the picker and the legend. */
export const ALL_SHIFT_TYPES: ShiftType[] = Object.keys(SHIFT_STYLES) as ShiftType[];

export const THEMES: ThemeType[] = ['Light', 'Dark'];
