/**
 * v9.4.xlsx Parser Library
 *
 * Parses aSc Timetables v9.4.xlsx export files for SMP ABBS Surakarta.
 * Ported from Laravel app/Http/Controllers/Teacher/ScheduleController.php
 *
 * See: .kilo/skills/v94-import/SKILL.md for the definitive guide.
 */

import * as XLSX from 'xlsx'
import {
  SUBJECT_DISPLAY_MAP,
  VALID_LESSONS_BY_DAY,
  LEADERSHIP_LABEL,
  resolveDayName,
  remapFridayLesson,
  genderOf,
  getBellTimes,
  normalizeClassName,
} from './bell-schedule'
import { normalizeSubject } from './subject-normalizer'
import type { ScheduleRecord } from './bell-schedule'

export interface LessonsResult {
  teacherMap: Map<string, string[]>
  leadershipParticipants: Map<string, string[]>
  teacherToClassesSubjects: Map<string, Array<[string, string]>>
  teacherNickToClassesSubjects: Map<string, Array<[string, string]>>
}

export interface NicknameMap {
  fullnameToNickname: Map<string, string>
  nicknameToFullname: Map<string, string>
  contractOf: Map<string, number>
}

function getCell(rows: unknown[][], rowIdx: number, colIdx: number): string {
  const row = rows[rowIdx]
  if (!row || colIdx >= row.length) return ''
  const val = row[colIdx]
  if (val === null || val === undefined) return ''
  return String(val)
}

function rowLength(row: unknown[] | undefined): number {
  return row ? row.length : 0
}

export function readClassesSheet(workbook: XLSX.WorkBook): string[] {
  const sheet = workbook.Sheets['Classes']
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
  const classes: string[] = []

  for (let i = 1; i < rows.length; i++) {
    const cls = getCell(rows, i, 0)
    if (cls === '') break
    const normalized = normalizeClassName(cls)
    classes.push(normalized)
  }

  return Array.from(new Set(classes))
}

export function readTeachersSheet(workbook: XLSX.WorkBook): NicknameMap {
  const sheet = workbook.Sheets['Teachers']
  const result: NicknameMap = {
    fullnameToNickname: new Map(),
    nicknameToFullname: new Map(),
    contractOf: new Map(),
  }

  if (!sheet) return result

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  for (let i = 1; i < rows.length; i++) {
    const name = getCell(rows, i, 1).trim()
    const nick = getCell(rows, i, 2).trim()
    const contractStr = getCell(rows, i, 5).trim()

    if (name === '') break

    if (name !== '' && nick !== '') {
      result.fullnameToNickname.set(name, nick)
      result.nicknameToFullname.set(nick, name)
    }

    if (contractStr !== '' && /^\d+$/.test(contractStr)) {
      result.contractOf.set(nick, parseInt(contractStr, 10))
    }
  }

  return result
}

export function readLessonsSheet(
  workbook: XLSX.WorkBook,
  nicknameMap: NicknameMap
): LessonsResult {
  const result: LessonsResult = {
    teacherMap: new Map(),
    leadershipParticipants: new Map(),
    teacherToClassesSubjects: new Map(),
    teacherNickToClassesSubjects: new Map(),
  }

  const sheet = workbook.Sheets['Lessons']
  if (!sheet) return result

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  for (let i = 1; i < rows.length; i++) {
    const teacherRaw = getCell(rows, i, 0).trim()
    const classField = getCell(rows, i, 1).trim()
    const subjectRaw = getCell(rows, i, 3).trim()

    if (subjectRaw === '' || classField === '') continue
    if (teacherRaw === 'Without teacher' || teacherRaw === '') continue

    const teachers = Array.from(new Set(
      teacherRaw
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n !== '')
        .map((n) => nicknameMap.fullnameToNickname.get(n) ?? n)
    ))

    let leadershipCode: string | null = null
    const canonicalSubject = normalizeSubject(subjectRaw)

    for (const [code, label] of Object.entries(LEADERSHIP_LABEL)) {
      if (canonicalSubject === 'Leadership' || subjectRaw === code || subjectRaw === label) {
        leadershipCode = code
        break
      }
    }

    if (leadershipCode) {
      const existing = result.leadershipParticipants.get(leadershipCode) ?? []
      result.leadershipParticipants.set(
        leadershipCode,
        Array.from(new Set([...existing, ...teachers]))
      )
      continue
    }

    if (!canonicalSubject) continue

    const classes = classField.split(',').map((c) => c.trim()).filter((c) => c !== '')

    for (const cls of classes) {
      const normalizedCls = normalizeClassName(cls)
      const key = `${normalizedCls}|${canonicalSubject}`

      const existing = result.teacherMap.get(key) ?? []
      result.teacherMap.set(key, Array.from(new Set([...existing, ...teachers])))

      for (const teacherNick of teachers) {
        const existingEntries = result.teacherNickToClassesSubjects.get(teacherNick) ?? []
        result.teacherNickToClassesSubjects.set(teacherNick, [
          ...existingEntries,
          [normalizedCls, canonicalSubject],
        ])
      }
    }
  }

  const nickToFull = nicknameMap.nicknameToFullname
  for (const [nick, entries] of result.teacherNickToClassesSubjects) {
    const fullName = nickToFull.get(nick) ?? nick
    const existing = result.teacherToClassesSubjects.get(fullName) ?? []
    result.teacherToClassesSubjects.set(fullName, [...existing, ...entries])
  }

  return result
}

export function processSubjectSheet(
  sheet: XLSX.WorkSheet,
  teacherMap: Map<string, string[]>,
  allClasses: string[]
): ScheduleRecord[] {
  const records: ScheduleRecord[] = []
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  const subjectRaw = getCell(rows, 0, 0)
  const subjectKey = subjectRaw.replace(/\.$/, '')
  const canonicalSubject = normalizeSubject(subjectRaw) || subjectRaw.toUpperCase()
  const displaySubject = SUBJECT_DISPLAY_MAP[subjectKey] ?? subjectRaw

  const maxCols = Math.max(...rows.map(rowLength), 3)

  for (let r = 3; r < rows.length; r++) {
    const day = getCell(rows, r, 1).trim()
    const rawLessonCell = getCell(rows, r, 2)

    if (day === '' || rawLessonCell === '') continue

    const dayResolved = resolveDayName(day)
    if (!dayResolved) continue

    const rawLesson = parseInt(rawLessonCell, 10)
    const lesson = remapFridayLesson(dayResolved, rawLesson)

    if (!VALID_LESSONS_BY_DAY[dayResolved]?.includes(lesson)) continue

    for (let col = 3; col <= maxCols; col++) {
      const cellValue = getCell(rows, r, col).trim()
      if (cellValue === '' || cellValue === '-') continue

      const classes = cellValue.split(',').map((c) => c.trim())

      for (const cls of classes) {
        const normalizedCls = normalizeClassName(cls)
        if (!allClasses.includes(normalizedCls)) continue

        const key = `${normalizedCls}|${canonicalSubject}`
        const teachers = teacherMap.get(key) ?? []
        const teacher = teachers.length > 0 ? teachers.join(', ') : null

        const gender = genderOf(normalizedCls)
        const [startTime, endTime] = getBellTimes(dayResolved, lesson, gender)

        records.push({
          class_name: normalizedCls,
          day: dayResolved,
          period: lesson,
          subject: canonicalSubject,
          subject_display: displaySubject.toUpperCase(),
          teacher,
          start_time: startTime,
          end_time: endTime,
        })
      }
    }
  }

  return records
}

export function processLeadershipSheet(
  sheet: XLSX.WorkSheet,
  participants: string[],
  code: string
): ScheduleRecord[] {
  const records: ScheduleRecord[] = []
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  const displaySubject = LEADERSHIP_LABEL[code] ?? 'Leadership'
  const grade = code.substring(1)

  const maxCols = Math.max(...rows.map(rowLength), 3)

  for (let r = 3; r < rows.length; r++) {
    const day = getCell(rows, r, 1).trim()
    const rawLessonCell = getCell(rows, r, 2)

    if (day === '' || rawLessonCell === '') continue

    const dayResolved = resolveDayName(day)
    if (!dayResolved) continue

    const rawLesson = parseInt(rawLessonCell, 10)
    const lesson = remapFridayLesson(dayResolved, rawLesson)

    if (!VALID_LESSONS_BY_DAY[dayResolved]?.includes(lesson)) continue

    // Gotcha #2: check if ANY column has data (mirrored), but only take col D
    let hasData = false
    for (let col = 3; col <= maxCols; col++) {
      const cellValue = getCell(rows, r, col).trim()
      if (cellValue !== '' && cellValue !== '-') {
        hasData = true
        break
      }
    }
    if (!hasData) continue

    // Take only from first non-empty column (col D = index 3)
    const firstColValue = getCell(rows, r, 3).trim()
    if (firstColValue === '' || firstColValue === '-') continue

    const [startTime, endTime] = getBellTimes(dayResolved, lesson, 'boys')

    records.push(
      ...participants.map(() => ({
        class_name: grade,
        day: dayResolved,
        period: lesson,
        subject: 'Leadership',
        subject_display: displaySubject.toUpperCase(),
        teacher: null,
        start_time: startTime,
        end_time: endTime,
      }))
    )
  }

  return records
}

export function processWithoutTeacherSheet(
  sheet: XLSX.WorkSheet,
  allClasses: string[]
): ScheduleRecord[] {
  const records: ScheduleRecord[] = []
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  const subjectRaw = getCell(rows, 0, 0)
  const subjectKey = subjectRaw.replace(/\.$/, '')
  const canonicalSubject = normalizeSubject(subjectRaw) || subjectRaw.toUpperCase()
  const displaySubject = SUBJECT_DISPLAY_MAP[subjectKey] ?? subjectRaw

  const maxCols = Math.max(...rows.map(rowLength), 3)

  for (let r = 3; r < rows.length; r++) {
    const day = getCell(rows, r, 1).trim()
    const rawLessonCell = getCell(rows, r, 2)

    if (day === '' || rawLessonCell === '') continue

    const dayResolved = resolveDayName(day)
    if (!dayResolved) continue

    const rawLesson = parseInt(rawLessonCell, 10)
    const lesson = remapFridayLesson(dayResolved, rawLesson)

    if (!VALID_LESSONS_BY_DAY[dayResolved]?.includes(lesson)) continue

    // Gotcha #2: check if ANY column has data, but only take col D
    let hasData = false
    for (let col = 3; col <= maxCols; col++) {
      const cellValue = getCell(rows, r, col).trim()
      if (cellValue !== '' && cellValue !== '-') {
        hasData = true
        break
      }
    }
    if (!hasData) continue

    const firstColValue = getCell(rows, r, 3).trim()
    if (firstColValue === '' || firstColValue === '-') continue

    const classes = firstColValue.split(',').map((c) => c.trim())

    for (const cls of classes) {
      const normalizedCls = normalizeClassName(cls)
      if (!allClasses.includes(normalizedCls)) continue

      records.push({
        class_name: normalizedCls,
        day: dayResolved,
        period: lesson,
        subject: canonicalSubject,
        subject_display: displaySubject.toUpperCase(),
        teacher: null,
        start_time: null,
        end_time: null,
      })
    }
  }

  return records
}

export function processAvailableTeachersFormat(
  workbook: XLSX.WorkBook,
  allClasses: string[],
  teacherToClassesSubjects: Map<string, Array<[string, string]>>,
  teacherNickToClassesSubjects: Map<string, Array<[string, string]>>,
  nickToFull: Map<string, string>
): ScheduleRecord[] {
  const records: ScheduleRecord[] = []

  const sheetsToProcess: Array<{ name: string; usesNicknames: boolean }> = []

  if (workbook.Sheets['Available teachers']) {
    sheetsToProcess.push({ name: 'Available teachers', usesNicknames: false })
  }
  if (!sheetsToProcess.length && workbook.Sheets['Available teachers 2']) {
    sheetsToProcess.push({ name: 'Available teachers 2', usesNicknames: true })
  }

  for (const sheetConfig of sheetsToProcess) {
    const sheet = workbook.Sheets[sheetConfig.name]
    if (!sheet) continue

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

    for (let r = 1; r < rows.length; r++) {
      const day = getCell(rows, r, 0).trim()
      const rawLessonCell = getCell(rows, r, 1)
      const teachersRaw = getCell(rows, r, 2).trim()

      if (day === '' || rawLessonCell === '' || teachersRaw === '') continue

      const dayResolved = resolveDayName(day)
      if (!dayResolved) continue

      const rawLesson = parseInt(rawLessonCell, 10)
      const lesson = remapFridayLesson(dayResolved, rawLesson)

      if (!VALID_LESSONS_BY_DAY[dayResolved]?.includes(lesson)) continue

      const teacherNames = teachersRaw
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n !== '')

      for (const teacherName of teacherNames) {
        let classesSubjects: Array<[string, string]>

        if (sheetConfig.usesNicknames) {
          classesSubjects = teacherNickToClassesSubjects.get(teacherName) ?? []
          // Resolve nickname → full name
        } else {
          classesSubjects = teacherToClassesSubjects.get(teacherName) ?? []
        }

        if (classesSubjects.length === 0) continue

        const resolvedTeacherName = sheetConfig.usesNicknames
          ? (nickToFull.get(teacherName) ?? teacherName)
          : teacherName

        for (const [cls, subject] of classesSubjects) {
          const normalizedCls = normalizeClassName(cls)
          if (!allClasses.includes(normalizedCls)) continue

          const gender = genderOf(normalizedCls)
          const [startTime, endTime] = getBellTimes(dayResolved, lesson, gender)

          records.push({
            class_name: normalizedCls,
            day: dayResolved,
            period: lesson,
            subject: subject,
            subject_display: subject.toUpperCase(),
            teacher: resolvedTeacherName,
            start_time: startTime,
            end_time: endTime,
          })
        }
      }
    }
  }

  return records
}

export function hasAvailableTeachersFormat(workbook: XLSX.WorkBook): boolean {
  return (
    workbook.Sheets['Available teachers'] !== undefined ||
    workbook.Sheets['Available teachers 2'] !== undefined
  )
}

export function generateEmailFromName(name: string): string {
  const emailLocal = name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9.]/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '')
  return `${emailLocal}@abbs.sch.id`
}
