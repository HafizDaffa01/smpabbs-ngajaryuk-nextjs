/**
 * Period System Utility
 * Indonesian school payroll/attendance reporting uses 21st-to-20th monthly cycles.
 */

export interface Period {
  key: string
  label: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
}

export const PERIODS: Period[] = [
  { key: 'jan_feb', label: 'Januari 21 - Februari 20', startMonth: 1, startDay: 21, endMonth: 2, endDay: 20 },
  { key: 'feb_mar', label: 'Februari 21 - Maret 20', startMonth: 2, startDay: 21, endMonth: 3, endDay: 20 },
  { key: 'mar_apr', label: 'Maret 21 - April 20', startMonth: 3, startDay: 21, endMonth: 4, endDay: 20 },
  { key: 'apr_mei', label: 'April 21 - Mei 20', startMonth: 4, startDay: 21, endMonth: 5, endDay: 20 },
  { key: 'mei_jun', label: 'Mei 21 - Juni 20', startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
  { key: 'jun_jul', label: 'Juni 21 - Juli 20', startMonth: 6, startDay: 21, endMonth: 7, endDay: 20 },
  { key: 'jul_agu', label: 'Juli 21 - Agustus 20', startMonth: 7, startDay: 21, endMonth: 8, endDay: 20 },
  { key: 'agu_sep', label: 'Agustus 21 - September 20', startMonth: 8, startDay: 21, endMonth: 9, endDay: 20 },
  { key: 'sep_okt', label: 'September 21 - Oktober 20', startMonth: 9, startDay: 21, endMonth: 10, endDay: 20 },
  { key: 'okt_nov', label: 'Oktober 21 - November 20', startMonth: 10, startDay: 21, endMonth: 11, endDay: 20 },
  { key: 'nov_des', label: 'November 21 - Desember 20', startMonth: 11, startDay: 21, endMonth: 12, endDay: 20 },
  { key: 'des_jan', label: 'Desember 21 - Januari 20', startMonth: 12, startDay: 21, endMonth: 1, endDay: 20 },
]

export function getCurrentPeriod(): Period {
  const now = new Date()
  const currentYear = now.getFullYear()

  for (const period of PERIODS) {
    const start = new Date(currentYear, period.startMonth - 1, period.startDay)
    const endYear = period.endMonth < period.startMonth ? currentYear + 1 : currentYear
    const end = new Date(endYear, period.endMonth - 1, period.endDay)

    if (now >= start && now <= end) {
      return period
    }
  }

  // Default to first period if no match
  return PERIODS[0]
}

export function getPeriodDateRange(periodKey: string, year: number): { start: Date; end: Date } {
  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[0]

  const start = new Date(year, period.startMonth - 1, period.startDay)
  const endYear = period.endMonth < period.startMonth ? year + 1 : year
  const end = new Date(endYear, period.endMonth - 1, period.endDay)

  return { start, end }
}

export function getSemesterMonths(semester: number): number[] {
  if (semester === 1) {
    return [1, 2, 3, 4, 5, 6]
  }
  return [7, 8, 9, 10, 11, 12]
}

export function formatPeriodLabel(period: Period): string {
  return period.label
}
