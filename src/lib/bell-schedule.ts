/**
 * Bell Schedule Utility
 *
 * Bell schedule for SMP ABBS Surakarta — confirmed by school authorities.
 * Covers Senin–Kamis (weekday), Jumat (no period 6), and Sabtu (6 periods,
 * 30 min each, gender rules inverted).
 *
 * See: Panduan Baca v9.4.xlsx (Jadwal aSc SMP ABBS).md — Section 4
 */

export const DAY_MAP: Record<string, string> = {
  SENIN: 'Monday',
  SELASA: 'Tuesday',
  RABU: 'Wednesday',
  KAMIS: 'Thursday',
  JUMAT: 'Friday',
  "JUM'AT": 'Friday',
  SABTU: 'Saturday',
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
}

export const SUBJECT_SHEETS = [
  'Sprt.', 'Soc.', 'Sc.', 'Quran.', 'Math.', 'IFE.', 'ICT.', 'Eng.', 'Cv.', 'BI.',
]

export const LEADERSHIP_SHEETS = [
  'LEADERSHIP 7.', 'LEADERSHIP 8.', 'LEASDERSHIP 9.',
]

export const LEADERSHIP_CODE_OF_SHEET: Record<string, string> = {
  'LEADERSHIP 7.': 'L7',
  'LEADERSHIP 8.': 'L8',
  'LEASDERSHIP 9.': 'L9',
}

export const LEADERSHIP_LABEL: Record<string, string> = {
  L7: 'Leadership 7',
  L8: 'Leadership 8',
  L9: 'Leadership 9',
}

export const LEADERSHIP_CLASS_MARKER = '__LEADERSHIP__'

export const WITHOUT_TEACHER_SHEETS = [
  'HOMEROOM TEACHER.', 'SCOUT.', 'SENI BUDAYA KESENIAN.', 'SELF DEVELOPMENT.',
]

export const SUBJECT_DISPLAY_MAP: Record<string, string> = {
  Sprt: 'SPORT',
  Soc: 'Social',
  Sc: 'Science',
  Quran: 'Quran',
  Math: 'Mathematics',
  IFE: 'IFE',
  ICT: 'ICT',
  Eng: 'English',
  Cv: 'Civics',
  BI: 'Indonesian',
}

export const VALID_LESSONS_BY_DAY: Record<string, number[]> = {
  Monday: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  Tuesday: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  Wednesday: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  Thursday: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  Friday: [1, 2, 3, 4, 5, 7, 8, 9],
  Saturday: [1, 2, 3, 4, 5, 6],
}

export const FRIDAY_RAW_TO_DISPLAY: Record<number, number> = {
  6: 7,
  7: 8,
  8: 9,
}

type TimePair = [string, string]

const WEEKDAY_BELLS: Record<number, TimePair> = {
  1: ['07:30:00', '08:10:00'],
  2: ['08:10:00', '08:50:00'],
  4: ['09:50:00', '10:30:00'],
  5: ['10:30:00', '11:10:00'],
  6: ['11:10:00', '11:50:00'],
  7: ['13:00:00', '13:40:00'],
  8: ['13:40:00', '14:20:00'],
  9: ['14:20:00', '15:00:00'],
}

const WEEKDAY_BELL3: Record<string, TimePair> = {
  boys: ['09:10:00', '09:50:00'],
  girls: ['08:50:00', '09:30:00'],
}

const FRIDAY_BELLS: Record<number, TimePair> = {
  1: ['07:30:00', '08:10:00'],
  2: ['08:10:00', '08:50:00'],
  4: ['09:50:00', '10:30:00'],
  5: ['10:30:00', '11:10:00'],
  7: ['13:00:00', '13:40:00'],
  8: ['13:40:00', '14:20:00'],
  9: ['14:20:00', '15:00:00'],
}

const FRIDAY_BELL3: Record<string, TimePair> = WEEKDAY_BELL3

const SATURDAY_BELLS: Record<number, TimePair> = {
  1: ['07:15:00', '07:45:00'],
  2: ['07:45:00', '08:15:00'],
  4: ['09:00:00', '09:30:00'],
  5: ['09:30:00', '10:00:00'],
  6: ['10:00:00', '10:30:00'],
}

const SATURDAY_BELL3: Record<string, TimePair> = {
  boys: ['08:15:00', '08:45:00'],
  girls: ['08:30:00', '09:00:00'],
}

const DAY_SCHEDULE: Record<string, [Record<number, TimePair>, Record<string, TimePair>]> = {
  Monday: [WEEKDAY_BELLS, WEEKDAY_BELL3],
  Tuesday: [WEEKDAY_BELLS, WEEKDAY_BELL3],
  Wednesday: [WEEKDAY_BELLS, WEEKDAY_BELL3],
  Thursday: [WEEKDAY_BELLS, WEEKDAY_BELL3],
  Friday: [FRIDAY_BELLS, FRIDAY_BELL3],
  Saturday: [SATURDAY_BELLS, SATURDAY_BELL3],
}

export function resolveDayName(day: string): string | null {
  return DAY_MAP[day.toUpperCase().trim()] ?? null
}

export function remapFridayLesson(day: string, rawLesson: number): number {
  if (day === 'Friday') {
    return FRIDAY_RAW_TO_DISPLAY[rawLesson] ?? rawLesson
  }
  return rawLesson
}

export function genderOf(className: string): 'boys' | 'girls' {
  const match = className.match(/\d([A-F])\b/i)
  if (match) {
    return ['A', 'B', 'C'].includes(match[1].toUpperCase()) ? 'boys' : 'girls'
  }
  return 'boys'
}

export function getBellTimes(day: string, period: number, gender: 'boys' | 'girls'): [string | null, string | null] {
  const [base, l3] = DAY_SCHEDULE[day]
  if (!base) return [null, null]

  if (period === 3) {
    return l3[gender] ?? [null, null]
  }

  const times = base[period]
  return times ?? [null, null]
}

export function normalizeClassName(cls: string): string {
  return cls.trim().replace(/\s+(ICT|TCP|IFE)\s*$/i, '')
}

export interface ScheduleRecord {
  class_name: string
  day: string
  period: number
  subject: string
  subject_display: string
  teacher: string | null
  start_time: string | null
  end_time: string | null
}
