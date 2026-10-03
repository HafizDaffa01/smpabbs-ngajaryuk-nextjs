# src/lib/

Domain / parsing logic with no React and no I/O side effects beyond reading an
in-memory workbook. Five files, all pure TypeScript:

| File | Lines | Job |
|---|---|---|
| `v94-parser.ts` | 467 | Parse aSc Timetables `v9.4.xlsx` exports into `ScheduleRecord[]` |
| `bell-schedule.ts` | 177 | Canonical day/period/gender + bell-time table (the domain source of truth) |
| `period-system.ts` | 67 | Academic-period (21st→20th) calendar helpers |
| `subject-normalizer.ts` | 95 | Canonicalise free-text subject names and the `profiles.mapel` JSONB shape |
| `utils.ts` | 3 | `cn()` class-name joiner |

The only third-party import in the whole folder is `xlsx`, and only in
`v94-parser.ts`.

## Responsibility

- Turn an uploaded aSc Timetables `.xlsx` export into flat
  `{class_name, day, period, subject, subject_display, teacher, start_time, end_time}`
  rows ready for the `schedules` table.
- Own the school calendar rules that every schedule/attendance surface depends on:
  which day names are valid, which lesson numbers are real on which day, the
  Friday 6/7/8 → 7/8/9 shift, and the bell times for each (day, period, gender).
- Own the academic-period model (12 periods, 21st → 20th) used for the period
  badge and the export/backup period selector.
- Own subject-name canonicalisation and the `profiles.mapel` JSONB codec.
- Provide one trivial class-name helper used by the two hand-rolled UI components.

## Design

**Layering: `bell-schedule` + `subject-normalizer` are leaves, `v94-parser` is the
only consumer-facing module.** `v94-parser.ts:11-22` imports nine symbols from
`bell-schedule` plus `normalizeSubject`; nothing in `bell-schedule.ts` or
`subject-normalizer.ts` imports anything local. There are no cycles.

**Strategy — one sheet-type handler per export layout.** `v94-parser.ts` exposes a
family of `process*` functions that all share one signature shape
(`(sheet, …context) => ScheduleRecord[]`) but differ in where the data columns
are and whether a teacher can be resolved:

| Exported fn | Line | Reads | Emits `teacher` | `start_time` |
|---|---|---|---|---|
| `processSubjectSheet(sheet, teacherMap, allClasses)` | 180 | `Sprt. Soc. Sc. …` | yes, from `teacherMap` | from bells |
| `processLeadershipSheet(sheet, participants, code)` | 243 | `LEADERSHIP 7./8.`, `LEASDERSHIP 9.` | no (`null`) | from bells (`'boys'`) |
| `processWithoutTeacherSheet(sheet, allClasses)` | 304 | `HOMEROOM TEACHER. …` | no (`null`) | `null` |
| `processAvailableTeachersFormat(workbook, allClasses, teacherToClassesSubjects, teacherNickToClassesSubjects, nickToFull)` | 368 | `Available teachers [2]` | yes, by name lookup | from bells |

The dispatch to "which strategy" is *not* a switch in `v94-parser.ts` — the
caller (`src/app/api/schedule/import/route.ts`) is expected to run the
`SUBJECT_SHEETS` / `LEADERSHIP_SHEETS` / `WITHOUT_TEACHER_SHEETS` lists from
`bell-schedule` itself. `hasAvailableTeachersFormat(workbook)` (line 453) is the
feature-detection probe for the v9.4 "Available teachers" export variant.

**Repository-ish key convention (the one place the parser touches shared state):
`` `${normalizedClass}|${canonicalSubject}` ``.** `readLessonsSheet` builds
`teacherMap` under that composite key (line 155) and `processSubjectSheet` reads
it back with the same construction (line 219). A teacher is only attached to a
class when the `Lessons` sheet produced an entry for *that exact
class+subject* pair — there is no per-class or per-subject fallback.

**Parser is defensive, not schema-driven.** Every sheet is read with
`XLSX.utils.sheet_to_json(sheet, { header: 1 })` and indexed through the private
helpers `getCell(rows, rowIdx, colIdx)` (line 37, returns `''` for out-of-range
rows/cols and `null`/`undefined`) and `rowLength(row)` (line 45). Column indices
are hard-coded literals, so the module is bound to one specific export layout.

**Table-driven bell model (`bell-schedule.ts`).**

```
DAY_SCHEDULE: Record<string, [regular, period3]>          // 124
  ├─ WEEKDAY_BELLS   (Mon–Thu)  : period → [start,end]
  ├─ WEEKDAY_BELL3              : gender → [start,end]
  ├─ FRIDAY_BELLS              : period → [start,end]
  ├─ FRIDAY_BELL3  = WEEKDAY_BELL3 (alias, line 109)
  └─ SATURDAY_BELLS / SATURDAY_BELL3
```

`getBellTimes(day, period, gender)` (line 152) looks up
`DAY_SCHEDULE[resolveDayName(day)]`, picks the second tuple when `period === 3`,
otherwise `regular[period] ?? null`, and returns `[start, end]`. Period 3 is
gender-split (`getBellTimes` consults the second table), which is why **no bell
map contains a key `3`** — the numeric maps skip from `2` to `4`. Concretely:
Mon–Thu start 07:30 with 40-minute periods; Friday has no period 6; Saturday runs
6 × 30-minute periods from 07:15.

**Guard chain applied to every row** (`processSubjectSheet` 195-238, mirrored at
256-286, 318-344, 392-422):
`day` resolved via `resolveDayName` → `parseInt` the raw lesson →
`remapFridayLesson` → membership test in `VALID_LESSONS_BY_DAY[day]` → per-column
class filter against `allClasses`.

**`FRIDAY_RAW_TO_DISPLAY` (line 75) + `remapFridayLesson` (line 137) are the
single documented source of "Gotcha #1"**: aSc numbers Friday's raw lessons
6/7/8, the app's `VALID_LESSONS_BY_DAY.Friday` is `[1,2,3,4,5,7,8,9]`, so raw
`6→7, 7→8, 8→9` and everything else passes through.

**`genderOf(className)` (line 144)** is a regex heuristic, not a lookup:
`/\d([A-F])\b/i` on the class name; suffix `A`/`B`/`C` ⇒ `'boys'`,
`D`/`E`/`F` ⇒ `'girls'`, default `'boys'`.

**`normalizeClassName` (line 164)** strips a trailing `ICT`/`TCP`/`IFE` token so
`7A-ICT` and `7A` collapse to one class. `LEADERSHIP_CLASS_MARKER = '__LEADERSHIP__'`
(line 47) is exported but never used anywhere in `src/`.

**Two normalisation strategies inside `subject-normalizer.ts`.** `SUBJECT_MAPPING`
(line 6, 17 canonical keys each with a variant array) is consumed by
`normalizeSubject(subject)` (line 26), which tries an exact match first, then an
`includes` substring match for variants longer than 2 characters, then falls
back to the upper-cased input rather than `null`. `normalizeMapel(mapel: unknown)`
(line 52) is an untyped decoder for the `profiles.mapel` JSONB column: it accepts
a JSON *string*, an array of plain strings, an array of `{kelas|class_name,
mapel|subject}` objects, or a bare object map — and always returns
`Record<string, string | string[]>`.

**`period-system.ts` is a calendar, not a schedule.** `PERIODS` (line 15) is 12
entries keyed `jan_feb` … `des_jan` with `start`/`end` day-of-month 21→20;
`getCurrentPeriod()` (line 30) matches today against them; `getPeriodDateRange`
(line 48) resolves a key + year into a `Date` pair; `getSemesterMonths` (line 58)
buckets month indices; `formatPeriodLabel` (line 65) produces the badge text.
`getPeriodDateRange` is naive about the year rollover — it is never called from
`src/`.

**`utils.ts` is the standard `clsx` + `tailwind-merge` joiner.** The whole file is:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

`clsx` collapses falsy values and `twMerge` resolves conflicting Tailwind
utilities (last-declaration-wins within a group), so `cn('px-2', 'px-4')`
yields `'px-4'`.

## Data Flow

**Import path (the module's only real workload).**

```
admin/schedule import form
  → POST /api/schedule/import        (multipart, field `file`)
    → XLSX.read(buffer)
    → readClassesSheet(wb)                        → allClasses: string[]
    → readTeachersSheet(wb)                        → NicknameMap
    → readLessonsSheet(wb, nickmap)                → LessonsResult { teacherMap, … }
    → for each SUBJECT_SHEETS  → processSubjectSheet(sheet, teacherMap, allClasses)
    → for each LEADERSHIP_SHEETS → processLeadershipSheet(sheet, participants, code)
    → for each WITHOUT_TEACHER_SHEETS → processWithoutTeacherSheet(sheet, allClasses)
    → if hasAvailableTeachersFormat(wb) → processAvailableTeachersFormat(…)
    → ScheduleRecord[]  →  upsert into `schedules`
```

Each `ScheduleRecord` is `{class_name, day, period, subject, subject_display,
teacher, start_time, end_time}` — the `ScheduleRecord` interface itself lives in
`bell-schedule.ts:168-177`, and `start_time`/`end_time` are `string | null`
(HH:MM strings, matching the Postgres `TIME` columns via PostgREST).

**Notable row-level behaviours worth knowing before debugging output:**

- **Gotcha #2 — only the first data column is read.** `processSubjectSheet` iterates
  *all* columns from index 3 to `maxCols` (line 209), but
  `processLeadershipSheet` (lines 270-283) and `processWithoutTeacherSheet`
  (lines 332-344) first scan for "any non-empty column" (`hasData`) and then
  read **only column index 3**. A row whose real data lives in column E is
  silently dropped. The code comments call this out explicitly.
- **Duplicate emission.** `processLeadershipSheet` pushes one record *per
  participant* (`participants.map(...)`, line 288) for the same
  `class_name = code.substring(1)` → `'7'`/`'8'`/`'9'` grade. Two teachers in
  `LEADERSHIP 7./8.` produce two rows for grade 7 in the same slot.
- **`processAvailableTeachersFormat` is duck-typed on teacher names, not
  positions.** Its row layout is transposed relative to every other sheet
  (day in col 0, lesson in col 1, comma-separated teacher list in col 2) and it
  expands each teacher into that teacher's *entire* class/subject list for the
  day, rather than reading a per-cell class column.
- **`generateEmailFromName(name)`** (line 460) slugifies a person name to
  `local@abbs.sch.id`: lowercase → every non-`[a-zA-Z0-9.]` char to `.` → collapse
  `..+` → trim leading/trailing `.`. It is called at
  `src/app/api/schedule/import/route.ts:204` to mint the `profiles.email` for each
  teacher the import discovers — the one place the schedule import also writes
  to `profiles`.

**Data Flow (read side).** Only `getCurrentPeriod()` is read at render time, by
`src/components/period-badge.tsx`. `getBellTimes` / `resolveDayName` /
`genderOf` / `normalizeClassName` are read at parse time. `getPeriodDateRange`,
`getSemesterMonths`, `formatPeriodLabel`, `getSubjectMapping`,
`readClassesSheet`'s callers, `DAY_MAP` and `SUBJECT_SHEETS`-adjacent exports
other than the three list constants are effectively dead inside `src/`.

## Integration Points

**Consumers, by import (grep-verified across `src/`).**

| Module | Imported by |
|---|---|
| `@/lib/v94-parser` | `src/app/api/schedule/import/route.ts` only (all 8 read/process fns + `generateEmailFromName`) |
| `@/lib/bell-schedule` | `src/lib/v94-parser.ts` (internal) **and** `src/app/api/schedule/import/route.ts` (`SUBJECT_SHEETS`, `LEADERSHIP_SHEETS`, `LEADERSHIP_CODE_OF_SHEET`, `WITHOUT_TEACHER_SHEETS`, `type ScheduleRecord`) |
| `@/lib/subject-normalizer` | `src/app/api/schedule/import/route.ts` (`normalizeMapel`), `src/app/api/admin/import-teachers/route.ts` (`normalizeSubject`, `normalizeMapel`) |
| `@/lib/period-system` | only `src/components/period-badge.tsx` → `getCurrentPeriod()` |
| `@/lib/utils` | `src/components/ui/skeleton.tsx`, `src/components/ui/empty-state.tsx` |

**Upstream dependencies.** `xlsx` (SheetJS) only, only in `v94-parser.ts:10`.
Nothing in `src/lib` imports `@/utils/supabase/*`, `next/*`, or any React
symbol — which is what makes the folder safely usable from both Route Handlers
and, in principle, client components.

**Downstream consumers of the parser's output.**

- `ScheduleRecord[]` → `schedules` table upsert, rendered by
  `src/app/schedule/page.tsx` and `src/app/api/schedule/route.ts`.
- `teacherToClassesSubjects` / `teacherNickToClassesSubjects` are what
  `processAvailableTeachersFormat` consumes; if the import route ever omits
  `readLessonsSheet`, the "Available teachers" path silently returns `[]`
  (line 422, `if (classesSubjects.length === 0) continue`).
- `normalizeMapel`'s output is written straight into `profiles.mapel` JSONB, which
  is why `src/app/journal/show/page.tsx:99-113,145-161` has to defensively handle
  `typeof subjects === 'string'` — the declared type in `src/types/index.ts` is
  narrower than what is actually stored.

**Known discrepancies.**

- `LEADERSHIP_SHEETS` (bell-schedule line 31) contains `'LEASDERSHIP 9.'` — a
  typo that exists in the upstream aSc export, so the constant has to preserve it.
- `getCurrentPeriod()` uses `new Date()` at call time, so a server-rendered
  `period-badge` is stamped at build/render time; there is no client refresh.
- `formatPeriodLabel`/`getPeriodDateRange`/`getSemesterMonths` are exported but
  have no in-repo consumer — the export and backup pages re-implement their own
  period table (see `src/app/export/codemap.md`).
- `cn` gives no Tailwind conflict resolution, so any `cn('p-2','p-4')` in the two
  UI components that use it depends on CSS source order, not on the argument
  order.
