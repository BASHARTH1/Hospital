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
  label: string;
  color: string;
  bg: string;
}

export const THEME_SHIFT_STYLES: Record<ThemeType, Record<ShiftType, ShiftStyle>> = {
  Professional: {
    [ShiftType.Morning]: { label: 'Morning', color: 'text-white', bg: 'bg-slate-700' },
    [ShiftType.Evening]: { label: 'Evening', color: 'text-white', bg: 'bg-blue-600' },
    [ShiftType.Night]: { label: 'Night', color: 'text-white', bg: 'bg-slate-900' },
    [ShiftType.Off]: { label: 'Off', color: 'text-slate-600', bg: 'bg-slate-100 border border-slate-200' },
    [ShiftType.Leave]: { label: 'Leave', color: 'text-white', bg: 'bg-red-500' },
    [ShiftType.PublicHoliday]: {
      label: 'Holiday',
      color: 'text-rose-600 font-extrabold',
      bg: 'bg-rose-50 border border-rose-200',
    },
    [ShiftType.MorningSpecial]: { label: 'M-Special', color: 'text-white', bg: 'bg-slate-500' },
    [ShiftType.MorningOnCall]: { label: 'M-OnCall', color: 'text-white', bg: 'bg-slate-400' },
    [ShiftType.EveningOnCall]: { label: 'E-OnCall', color: 'text-white', bg: 'bg-blue-400' },
    [ShiftType.NightOnCall]: { label: 'N-OnCall', color: 'text-white', bg: 'bg-slate-800' },
    [ShiftType.RequestedMorning]: { label: 'Req M', color: 'text-white', bg: 'bg-slate-700 ring-2 ring-red-400' },
    [ShiftType.RequestedEvening]: { label: 'Req E', color: 'text-white', bg: 'bg-blue-700 ring-2 ring-red-400' },
    [ShiftType.RequestedNight]: { label: 'Req N', color: 'text-white', bg: 'bg-black ring-2 ring-red-400' },
    [ShiftType.RequestedOff]: { label: 'Req Off', color: 'text-white', bg: 'bg-slate-400 ring-2 ring-red-400' },
    [ShiftType.None]: { label: 'None', color: 'text-slate-300', bg: 'bg-white' },
  },
  Colorful: {
    [ShiftType.Morning]: { label: 'Morning', color: 'text-white', bg: 'bg-emerald-500' },
    [ShiftType.Evening]: { label: 'Evening', color: 'text-white', bg: 'bg-fuchsia-500' },
    [ShiftType.Night]: { label: 'Night', color: 'text-white', bg: 'bg-orange-600' },
    [ShiftType.Off]: { label: 'Off', color: 'text-emerald-700', bg: 'bg-emerald-50 border border-emerald-100' },
    [ShiftType.Leave]: { label: 'Leave', color: 'text-white', bg: 'bg-rose-500' },
    [ShiftType.PublicHoliday]: { label: 'Holiday', color: 'text-white', bg: 'bg-rose-600' },
    [ShiftType.MorningSpecial]: { label: 'M-Special', color: 'text-white', bg: 'bg-teal-400' },
    [ShiftType.MorningOnCall]: { label: 'M-OnCall', color: 'text-white', bg: 'bg-lime-500' },
    [ShiftType.EveningOnCall]: { label: 'E-OnCall', color: 'text-white', bg: 'bg-pink-400' },
    [ShiftType.NightOnCall]: { label: 'N-OnCall', color: 'text-white', bg: 'bg-amber-700' },
    [ShiftType.RequestedMorning]: { label: 'Req M', color: 'text-white', bg: 'bg-emerald-700' },
    [ShiftType.RequestedEvening]: { label: 'Req E', color: 'text-white', bg: 'bg-fuchsia-700' },
    [ShiftType.RequestedNight]: { label: 'Req N', color: 'text-white', bg: 'bg-orange-800' },
    [ShiftType.RequestedOff]: { label: 'Req Off', color: 'text-white', bg: 'bg-amber-400' },
    [ShiftType.None]: { label: 'None', color: 'text-gray-300', bg: 'bg-white' },
  },
  Attractive: {
    [ShiftType.Morning]: {
      label: 'Morning',
      color: 'text-white',
      bg: 'bg-gradient-to-br from-cyan-400 to-blue-500',
    },
    [ShiftType.Evening]: {
      label: 'Evening',
      color: 'text-white',
      bg: 'bg-gradient-to-br from-purple-500 to-indigo-600',
    },
    [ShiftType.Night]: { label: 'Night', color: 'text-white', bg: 'bg-gradient-to-br from-slate-800 to-black' },
    [ShiftType.Off]: { label: 'Off', color: 'text-blue-900', bg: 'bg-blue-50/50 backdrop-blur-sm' },
    [ShiftType.Leave]: { label: 'Leave', color: 'text-white', bg: 'bg-gradient-to-br from-rose-400 to-red-600' },
    [ShiftType.PublicHoliday]: {
      label: 'Holiday',
      color: 'text-white',
      bg: 'bg-gradient-to-br from-rose-500 to-pink-600',
    },
    [ShiftType.MorningSpecial]: { label: 'M-Special', color: 'text-white', bg: 'bg-cyan-300' },
    [ShiftType.MorningOnCall]: { label: 'M-OnCall', color: 'text-white', bg: 'bg-sky-300' },
    [ShiftType.EveningOnCall]: { label: 'E-OnCall', color: 'text-white', bg: 'bg-violet-300' },
    [ShiftType.NightOnCall]: { label: 'N-OnCall', color: 'text-white', bg: 'bg-slate-700' },
    [ShiftType.RequestedMorning]: { label: 'Req M', color: 'text-white', bg: 'bg-cyan-600 ring-2 ring-pink-500' },
    [ShiftType.RequestedEvening]: { label: 'Req E', color: 'text-white', bg: 'bg-purple-600 ring-2 ring-pink-500' },
    [ShiftType.RequestedNight]: { label: 'Req N', color: 'text-white', bg: 'bg-slate-900 ring-2 ring-pink-500' },
    [ShiftType.RequestedOff]: { label: 'Req Off', color: 'text-white', bg: 'bg-slate-500 ring-2 ring-pink-500' },
    [ShiftType.None]: { label: 'None', color: 'text-gray-200', bg: 'bg-transparent' },
  },
  Day: {
    [ShiftType.Morning]: { label: 'Morning', color: 'text-amber-900', bg: 'bg-amber-400' },
    [ShiftType.Evening]: { label: 'Evening', color: 'text-orange-900', bg: 'bg-orange-300' },
    [ShiftType.Night]: { label: 'Night', color: 'text-white', bg: 'bg-sky-900' },
    [ShiftType.Off]: { label: 'Off', color: 'text-amber-600', bg: 'bg-yellow-50' },
    [ShiftType.Leave]: { label: 'Leave', color: 'text-white', bg: 'bg-red-400' },
    [ShiftType.PublicHoliday]: {
      label: 'Holiday',
      color: 'text-rose-900',
      bg: 'bg-rose-200 border border-rose-300',
    },
    [ShiftType.MorningSpecial]: { label: 'M-Special', color: 'text-amber-900', bg: 'bg-yellow-400' },
    [ShiftType.MorningOnCall]: { label: 'M-OnCall', color: 'text-amber-900', bg: 'bg-yellow-200' },
    [ShiftType.EveningOnCall]: { label: 'E-OnCall', color: 'text-orange-900', bg: 'bg-orange-100' },
    [ShiftType.NightOnCall]: { label: 'N-OnCall', color: 'text-white', bg: 'bg-sky-800' },
    [ShiftType.RequestedMorning]: {
      label: 'Req M',
      color: 'text-amber-900',
      bg: 'bg-amber-500 border-2 border-orange-500',
    },
    [ShiftType.RequestedEvening]: {
      label: 'Req E',
      color: 'text-orange-900',
      bg: 'bg-orange-400 border-2 border-red-500',
    },
    [ShiftType.RequestedNight]: { label: 'Req N', color: 'text-white', bg: 'bg-blue-900 border-2 border-red-500' },
    [ShiftType.RequestedOff]: {
      label: 'Req Off',
      color: 'text-amber-700',
      bg: 'bg-yellow-100 border-2 border-red-500',
    },
    [ShiftType.None]: { label: 'None', color: 'text-gray-200', bg: 'bg-white' },
  },
  Night: {
    [ShiftType.Morning]: { label: 'Morning', color: 'text-cyan-400', bg: 'bg-slate-800 border border-cyan-500/30' },
    [ShiftType.Evening]: {
      label: 'Evening',
      color: 'text-purple-400',
      bg: 'bg-slate-800 border border-purple-500/30',
    },
    [ShiftType.Night]: { label: 'Night', color: 'text-white', bg: 'bg-indigo-600' },
    [ShiftType.Off]: { label: 'Off', color: 'text-slate-500', bg: 'bg-slate-900' },
    [ShiftType.Leave]: { label: 'Leave', color: 'text-rose-400', bg: 'bg-slate-800 border border-rose-500/30' },
    [ShiftType.PublicHoliday]: {
      label: 'Holiday',
      color: 'text-rose-400',
      bg: 'bg-slate-800 border border-rose-500/30',
    },
    [ShiftType.MorningSpecial]: {
      label: 'M-Special',
      color: 'text-cyan-300',
      bg: 'bg-slate-800 border border-cyan-400',
    },
    [ShiftType.MorningOnCall]: { label: 'M-OnCall', color: 'text-cyan-200', bg: 'bg-slate-700' },
    [ShiftType.EveningOnCall]: { label: 'E-OnCall', color: 'text-purple-200', bg: 'bg-slate-700' },
    [ShiftType.NightOnCall]: { label: 'N-OnCall', color: 'text-white', bg: 'bg-indigo-500' },
    [ShiftType.RequestedMorning]: {
      label: 'Req M',
      color: 'text-cyan-400',
      bg: 'bg-slate-800 ring-1 ring-cyan-400',
    },
    [ShiftType.RequestedEvening]: {
      label: 'Req E',
      color: 'text-purple-400',
      bg: 'bg-slate-800 ring-1 ring-purple-400',
    },
    [ShiftType.RequestedNight]: { label: 'Req N', color: 'text-white', bg: 'bg-indigo-700 ring-1 ring-white' },
    [ShiftType.RequestedOff]: { label: 'Req Off', color: 'text-slate-400', bg: 'bg-slate-800 ring-1 ring-slate-400' },
    [ShiftType.None]: { label: 'None', color: 'text-slate-700', bg: 'bg-black' },
  },
};

/** Fallback for parts of the app that use a default look. */
export const SHIFT_DETAILS = THEME_SHIFT_STYLES.Professional;

/** Every shift code in display order (matches the original `Object.keys` order). */
export const ALL_SHIFT_TYPES: ShiftType[] = Object.keys(SHIFT_DETAILS) as ShiftType[];

export const THEMES: ThemeType[] = ['Professional', 'Colorful', 'Attractive', 'Day', 'Night'];
