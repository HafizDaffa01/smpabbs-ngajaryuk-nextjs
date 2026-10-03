# src/app/journal/show/

## Responsibility

The **KBM (journal / lesson-note) editor** — the functional heart of NgajarYuk. One screen combines three concerns that the legacy app split across separate pages:

1. **Student daily attendance grid** for a month (`attendances`, values `S`/`I`/`A`).
2. **KBM lesson notes** per subject for a given day (`notes` rows keyed `class + subject + date`).
3. **Schedule awareness** — which teacher teaches which subject in this class today (`schedules`), rendered as a read-only roster.

`journal-form.tsx` is the largest file in the repo at **639 lines**.

| File | Kind | Lines | Exports |
|---|---|---|---|
| `page.tsx` | Async Server Component | 275 | `dynamic`, `generateMetadata`, default `JournalShowPage` |
| `journal-form.tsx` | Client Component (`'use client'`) | 639 | default `JournalForm(JournalFormProps)` |

## Design

### `page.tsx` — the query/orchestration layer

Every read happens here on the server; the client receives fully-computed plain objects.

- `export const dynamic = 'force-dynamic'` — never cached, because the output depends on cookies, query params and the current date.
- `generateMetadata({ searchParams })` → `title: params.class ? \`Jurnal Kelas ${params.class} - NgajarYuk\` : 'Jurnal Kelas - NgajarYuk'`.
- **Params:** `class`, `usr`, `month`, `year`, `day` (all `Promise<...>` in the type signature). `grade = (params.class ?? '').toUpperCase()`; `usr = params.usr ?? user.id` (assigned but never used afterwards — see "Dead ends" below). Missing `class` → `redirect('/journal')`.
- **Date resolution:** `day/month/year` default to `now.getDate() / getMonth()+1 / getFullYear()`. `selectedDate = new Date(year, month - 1, day)`; `selectedDateStr = selectedDate.toISOString().split('T')[0]`.
- **Students:** `students.select('*').order('name')`, branching on grade — for `['7','8','9']` it uses `.ilike('grade', \`${grade}%\`)` (Leadership cohorts all share the digit prefix, e.g. `7A`, `7B`, `7C`); otherwise `.eq('grade', grade)`.

**Schedule lookup (day-of-week resolution):**

```ts
const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' })  // "Wednesday"
let q = supabase.from('schedules').select('*').eq('day', dayOfWeek).order('period')
if (['7','8','9'].includes(grade))
  q = q.or(`class_name.ilike.${grade}%,subject.ilike.%Leadership%,subject_display.ilike.%Leadership%`)
else
  q = q.eq('class_name', grade)
```

So the schedule list is **not** month-scoped — it is whatever the timetable says for that weekday. The `%Leadership%` alternatives let a grade's Leadership subject surface even when the row's `class_name` is not prefixed by the grade.

**Subject display (`subject_display`) is used only as a matching fallback.** It appears in the `.or(...)` predicate above and in `src/app/schedule/page.tsx` (`sched.subject_display || sched.subject`). In this route the *displayed* subject name comes from `profiles.mapel`, not from `schedules.subject`.

**Teacher resolution — the trickiest logic in the file.** `schedules.teacher` is free text and may be `null` or `'-'`, so the page rebuilds a teacher→subjects map from two sources:

1. `leadershipTeachers`: for grades 7/8/9, `profiles.select('name, mapel').eq('is_admin', false)`, filtered in JS — a teacher qualifies if any `mapel[grade]` value (string or array) contains `'leadership'` case-insensitively **and** (`String(key).toLowerCase().startsWith(grade.toLowerCase())` **or** `String(value).toLowerCase().includes(grade.toLowerCase())`). These are seeded into `teachersMap` with a synthetic `mapel = { [grade]: ['Leadership'] }`.
2. Schedule-derived teachers: for each schedule row, `sched.teacher?.trim()`, skipping `''` and `'-'`; then a **per-teacher** lookup `profiles.select('name, mapel').eq('name', tName).single()` to hydrate `mapel`. Matching is by lowercased name key. This is an **N+1 query loop** — one extra round trip per distinct teacher.

**`mapelList` — the subject→teachers index** that drives both the roster cards and the KBM editor's list:

```ts
const mapelList: Record<string, string[]> = {}
// for each teacher: subjects = t.mapel[grade]  (handles string | string[])
// mapelList[subject] = [...teacher names]      (de-duped)
```

**Attendance:** `attendances.select('*').in('student_id', studentIds).eq('month', month).eq('year', year)` → two derived structures, `attendanceMap: Map<string /*studentId*/, Map<number /*day*/, 'S'|'I'|'A'>>` and `summaryMap: Map<number /*studentId*/, {S: number, I: number, A: number}>` (seeded to zeros for every student first, then incremented per row).

**Notes — two queries, two index shapes:**

| Query | Result | Used as |
|---|---|---|
| `notes.eq('class', grade).eq('date', selectedDateStr)` | `noteList` (passed to the client, unused there) | raw list |
| `notes.eq('class', grade).gte('date', \`${year}-${monthStr}-01\`).lte('date', \`${year}-${monthStr}-31\`)` | `noteIndexedAll` keyed `` `${note.date}_${note.subject}` `` | the month-wide cache the client filters locally |
| derived | `noteIndexed` — subset where `note.date === selectedDateStr`, keyed `subject` | the notes for the selected day |

Both dates are zero-padded with `String(month).padStart(2, '0')`.

**Admin flag:** `profiles.select('is_admin').eq('id', user.id).single()` → `isAdmin`, passed down so the client can show "Export Excel". The server enforces the same rule again in `/api/journal/export`.

**Render:** `.min-vh-100.bg-body > main.container.pb-5 > .card-brutalist` whose header shows `.section-label` `JOURNAL_KELAS`, `Jurnal Kelas {grade}`, the `id-ID` long date, and `<Link href="/journal" className="btn-brutalist-outline">Kembali</Link>`. Body mounts `<JournalForm ... />` with 12 props.

### `journal-form.tsx` — client shell

**Props:** `grade, day, month, year, students, mapelList, attendanceMap, summaryMap, noteList, noteIndexed, noteIndexedAll, schedules, isAdmin`.

**State:** `selectedDay`, `loading`, `message: { type: 'success'|'error'; text: string } | null`, `localAttendanceMap`, `localNoteIndexed`, `localNoteIndexedAll`, `teachersExpanded`, `kbmExpanded`, `attendanceExpanded`, `allExpanded`. Refs: `dateInputRef`, `flatpickrRef`.

**Flatpickr date navigation.** Initialised on `dateInputRef` with `{ dateFormat: 'd/m/Y', defaultDate: \`${day}/${month}/${year}\`, locale: 'id', allowInput: true, onChange: (dates) => setSelectedDay(dates[0].getDate()) }`, guarded by `if (dateInputRef.current && !flatpickrRef.current)`, destroyed in the effect cleanup. **Only the day changes** — picking a date in another month silently leaves `month`/`year` untouched, so the picker is a day-stepper with a calendar affordance. `daysInMonth = new Date(year, month, 0).getDate()`; `handlePrevDay` / `handleNextDay` clamp at 1 and `daysInMonth` and disable the buttons at the bounds.

**Client-side note re-indexing** (the key to "switch days without losing data"):

```ts
useEffect(() => {
  const dateStr = `${year}-${pad2(month)}-${pad2(selectedDay)}`
  const dayNotes: NoteIndexed = {}
  for (const [key, note] of Object.entries(localNoteIndexedAll))
    if (note.date === dateStr) dayNotes[note.subject] = note
  setLocalNoteIndexed(dayNotes)
}, [selectedDay, month, year, localNoteIndexedAll])
```

Because `localNoteIndexedAll` is kept in sync on every successful single-note save, a saved note survives day switches without a refetch.

**Save flow A — bulk (`handleSaveAll`)**, bound to "Simpan Semua":

1. Builds `attendanceData` by iterating `students` and pushing `{ student_id, day: selectedDay, value }` only when a value exists for that day.
2. Builds `kbmData` by iterating `Object.values(localNoteIndexed)` and pushing `{ subject, date: dateStr, time: note.time, note: note.note, teacher_id: note.teacher_id ?? undefined }` only when `note.note.trim()` is non-empty.
3. `POST /api/journal/save-all?class=<encodeURIComponent(grade)>` with `{ month, year, attendance, kbm }`.
4. Sets `message` to `'Data berhasil disimpan!'` or to `data.error`/the thrown message.

**Save flow B — single note (`handleSaveNote(subject, note)`)**, handed to `KbmEditor` as `onSave`:

1. `POST /api/journal/save-note` with `{ class: grade, subject, teacher_id: null, date: dateStr, time: new Date().toTimeString().slice(0,5), note, checked: true }`.
2. On success, optimistically writes the note into **both** `localNoteIndexed` and `localNoteIndexedAll` (spreading any existing row, defaulting `{ id: 0, class: grade, subject, teacher_id: null, date: dateStr, time: timeStr, note: '', checked: false }`, then overriding `note` and `checked: true`).
3. On failure it `console.error`s and **rethrows**, which is what lets `KbmEditor` render its `Swal.fire({ icon: 'error', ... })`.

Note that `time` is taken from the *client's* wall clock (`new Date().toTimeString().slice(0,5)`), and `teacher_id` is always sent as `null` — the API substitutes `user.id`.

**Attendance change (`handleAttendanceChange(studentId, d, value)`):** copy-on-write into `localAttendanceMap`; an empty `''` value `delete`s the day key, which is how a mark is cleared.

**Export (`handleExportExcel`)**: guarded by `if (!isAdmin) return`; `window.open('/api/journal/export?class=&month=MM&year=', '_blank')` — a plain navigation, so the response streams as a file download.

**Layout — five stacked `.card-brutalist` blocks:**

1. **Branding:** `JOURNAL OF {grade} / ABBS JUNIOR HIGH SCHOOL`.
2. **Message banner:** rendered only when `message` is set, as `.card-brutalist` + `border-success`/`border-danger` with `borderLeft: 4px solid var(--success|danger)`.
3. **Date navigation:** prev/next buttons + flatpickr input (140px wide, `readOnly`) + `id-ID` long date + (`isAdmin &&` "Export Excel") + "Simpan Semua" (`loading` → `'Menyimpan...'`). The Expand All / Collapse All buttons live in this same card, as a sub-header above the attendance section.
4. **Guru & Mata Pelajaran** (collapsible, lucide `Users`): `row g-3` of `col-md-4` cards, one per `Object.entries(mapelList)` entry, showing subject + `teacherNames.join(', ')`. Empty → `"Tidak ada jadwal untuk hari ini."`.
5. **Absensi Siswa** (collapsible, lucide `CheckSquare`): `<AttendanceGrid students={} attendanceMap={localAttendanceMap} summaryMap={} day={selectedDay} month year grade onAttendanceChange={handleAttendanceChange} />`.
6. **Jurnal KBM** (collapsible, lucide `BookOpen`): `<KbmEditor subjects={subjectsList} noteIndexed={localNoteIndexed} classValue={grade} selectedDate={selectedDate} onSave={handleSaveNote} />`.

Collapsible sections share one pattern: a full-width `<button type="button">` header with a rotating `<ChevronDown className={... rotate-180}>` plus a `{x && <div className="border-top border-color p-3">…}` body.

**Inline global CSS.** The component embeds a `<style jsx global>` block (~90 lines) re-declaring `.attendance-grid-container` rules that also exist in the design system: monospace font, 2px `var(--dark-400)` borders, `.sticky-col`/`.sticky-col-header`, `.today-col`, `.selected-col`, `.attendance-dropdown`, `.summary-s/i/a`, `.attendance-badge`. This duplicates `src/components/attendance-grid.tsx`'s own inline style objects (which use Bootstrap utility classes like `bg-primary`, `sticky-col-header`) — the two styling systems coexist and partially disagree.

### `src/components/attendance-grid.tsx` (client, 213 lines)

- Props: `students, attendanceMap, summaryMap, day, month, year, grade, onAttendanceChange`. **`grade` is destructured but never used in the body.**
- State: `searchQuery`, `openCell: { studentId, day } | null`. `filteredStudents` via `useMemo` on `s.name.toLowerCase().includes(q)`. `daysInMonth = new Date(year, month, 0).getDate()`.
- A `document.addEventListener('mousedown', handleClickOutside)` effect closes the open dropdown when the click falls outside `gridRef`.
- **Table geometry:** `table-layout: fixed` with `minWidth: daysInMonth*36 + 80 (No) + 140 (Nama) + 36*3 (summary)`. Both the No and Nama columns are `position-sticky start-0 top-0` (the Nama column gets `left: 80px`), header cells `z-20`, body cells `z-10`.
- **Column highlighting:** `isSelected(d) = d === day` → `bg-primary text-white fw-bold`; `isToday(d)` compares day+month+year against the browser's `new Date()` → `bg-info text-dark fw-semibold`.
- **Cell interaction:** clicking a `<td>` sets `openCell`; the dropdown offers `(['S','I','A',''] as const)` — the empty option renders as an em-dash `—` to clear the mark — and calls `selectValue` with `e.stopPropagation()` so the `td`'s own handler does not immediately reopen it. `getValueBadgeClass` maps S→`bg-primary`, I→`bg-warning`, A→`bg-danger`.
- **Summary columns** read the *server-computed* `summaryMap[student.id]` (defaulting to zeros). They are **not** recomputed on local edits, so S/I/TOT go stale until the page is re-fetched. `TOT` = `summary.S + summary.I + summary.A`.
- `import Flatpickr from 'flatpickr'` is present but **never used** (no date picker in this component) — dead import.

### `src/components/kbm-editor.tsx` (client, 260 lines)

- Props: `subjects: SubjectInfo[]`, `noteIndexed`, `classValue`, `selectedDate`, `onSave`. **`classValue` is destructured but unused** — the class is already baked into `noteIndexed`'s rows.
- State: `isOpen`, `currentSubject`, `noteText`, `saving`. Refs `dateInputRef`, `flatpickrRef`.
- `dateStr = selectedDate.toISOString().split('T')[0]`, `displayDate` in `id-ID` long form.
- Flatpickr on `#kbm-date` with `{ dateFormat: 'Y-m-d', defaultDate: dateStr, locale: 'id', allowInput: true, onChange: … }` — the `onChange` body is an empty comment (`// Update the selected date in parent if needed`), so **the modal's date field is display-only**.
- `openEditor(subject)` seeds `noteText` from `noteIndexed[subject]?.note || ''`; `closeEditor()` resets.
- `handleSave()`: refuses empty text with `Swal.fire({ icon: 'warning', title: 'Catatan kosong', text: 'Masukkan catatan KBM terlebih dahulu' })`; otherwise `await onSave(currentSubject, noteText.trim())` then `Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Catatan KBM berhasil disimpan' })` + `closeEditor()`; `catch` → `Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menyimpan catatan KBM' })`. **This is the only place in this route where sweetalert2 is actually used** — `journal-form.tsx` imports `Swal` (line 16) and never calls it.
- List: one `.card-brutalist` per subject, `cursor-pointer`, `border-success` when `existing?.note?.trim()`, a 100-char preview with `...` truncation, `Guru: {teachers.join(', ')}`, a `"Tersimpan"` badge, and a Tambah/Edit button. Empty `subjects` → `"Tidak ada jadwal untuk hari ini."`
- Modal: `.modal-overlay` > `.modal-content-custom` with inline `borderRadius: 0`, a `.card-brutalist-header` + lucide `X` close button, read-only date and subject inputs, a 6-row textarea, and Batal / Simpan buttons.

## Data Flow

### Read (all server-side, no client fetch)

```
cookies() → createClient
  auth.getUser()                              → 401-free guard, redirect('/login')
  students .select('*') .order('name')        (+ ilike/eq grade)
  schedules .select('*') .eq('day', weekday) .order('period')  (+ or() for 7/8/9)
  profiles  .select('name, mapel') .eq('is_admin', false)        [grades 7/8/9 only]
  profiles  .select('name, mapel') .eq('name', <each teacher>)   [N+1]
  attendances .in('student_id', ids) .eq('month') .eq('year')
  notes     .eq('class') .eq('date', selectedDateStr)
  notes     .eq('class') .gte(date, YYYY-MM-01) .lte(date, YYYY-MM-31)
  profiles  .select('is_admin') .eq('id', user.id)
```

Everything crosses the server/client boundary as plain JSON objects — `Map`s are converted with `Object.fromEntries(...)` before being passed to `JournalForm`.

### Write

| Trigger | Endpoint | Body | Notes |
|---|---|---|---|
| "Simpan Semua" | `POST /api/journal/save-all?class=<grade>` | `{ month, year, attendance: [{student_id, day, value}], kbm: [{subject, date, time, note, teacher_id}] }` | bulk upsert of the selected day |
| KBM modal save | `POST /api/journal/save-note` | `{ class, subject, teacher_id: null, date, time, note, checked: true }` | single-row upsert; optimistic local mirror |
| Admin export | `GET /api/journal/export?class=&month=&year=` | — | `window.open`, xlsx download |

### `src/app/api/journal/save-all/route.ts`

1. `auth.getUser()` → **401**.
2. `!month || !year` → **400** `'Bulan dan tahun harus diisi'`; missing `class` search param → **400** `'Kelas harus diisi'`.
3. Attendance: **sequential loop** of `supabase.from('attendances').upsert({ student_id, day, month, year, value }, { onConflict: 'student_id,day,month,year' })`; first error → **500** `'Gagal menyimpan absensi'`.
4. KBM: skips rows missing `subject`/`date`/`time`/`note`, then `supabase.from('notes').upsert({ class: classParam, subject, date, time, note, checked: true, teacher_id: k.teacher_id ?? user.id }, { onConflict: 'class,subject,date' })`; first error → **500** `'Gagal menyimpan catatan KBM'`.
5. `{ success: true }`. **Not transactional** — a failure part-way leaves earlier rows committed, and the client only sees a generic error message.

### `src/app/api/journal/save-note/route.ts`

1. `auth.getUser()` → **401**. Missing any of `class`/`subject`/`date`/`time`/`note` → **400** `'Data tidak lengkap'`.
2. `upsert({ class, subject, date, time, note, checked: checked ?? true, teacher_id: teacher_id ?? user.id }, { onConflict: 'class,subject,date' })` → **500** on error, else `{ success: true }`.
3. Because the client always sends `teacher_id: null`, `?? user.id` kicks in and the authenticated user becomes the note author.

### `src/app/api/journal/export/route.ts`

- Admin-only (`profiles.is_admin`, else **403**), requires `class`/`month`/`year` (**400**), **404** when the class has no students.
- Builds a workbook with `xlsx`: sheet **`Absensi`** = header `['Nama Siswa', 1..31, 'S', 'I', 'A']` then one row per student with `att?.value || ''` per day and per-student S/I/A totals; sheet **`KBM`** = header `['Tanggal','Mapel','Guru','Catatan']` with `{ date, subject, teacher_id || '-', note }` for every note in the month range.
- Streams `xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })` with `Content-Disposition: attachment; filename=jurnal_kelas_<grade>_<month>_<year>.xlsx`.

## Integration Points

- **Tables:** `students` (`id`, `name`, `progul`, `grade`), `schedules` (`class_name`, `day`, `period`, `subject`, `subject_display`, `teacher`, `start_time`, `end_time`), `profiles` (`name`, `mapel` jsonb, `is_admin`), `attendances` (`student_id`, `day`, `month`, `year`, `value`), `notes` (`class`, `subject`, `teacher_id`, `date`, `time`, `note`, `checked`).
- **Unique indexes the code depends on:** `idx_attendances_unique (student_id, day, month, year)` and `idx_notes_class_subject_date (class, subject, date)` — both are exactly the `onConflict` targets used by the two save endpoints.
- **Domain libs (adjacent but *not* imported here):** `@/lib/subject-normalizer` (`normalizeSubject`, `normalizeMapel`) is used by the schedule importer and admin teacher manager to canonicalise subject names; this page instead matches raw `mapel` values with `'leadership'.includes()` logic, so a subject stored as e.g. `'Pramuka'` would not be recognised as Leadership here. `@/lib/period-system` and `@/lib/bell-schedule` (which owns `subject_display` semantics, `DAY_MAP`, `SUBJECT_DISPLAY_MAP`, `getBellTimes`) are used by the schedule/export/admin segments, not by this route.
- **Shared components:** `AttendanceGrid`, `KbmEditor`. Neither uses `useToast()`; KbmEditor uses sweetalert2 directly, JournalForm uses an inline banner.
- **Third-party:** `flatpickr` (+ `flatpickr/dist/themes/airbnb.css`, `flatpickr/dist/l10n/id.js`) for date input; `sweetalert2` for modal confirmations; `xlsx` on the export endpoint; lucide-react icons.
- **Auth:** `/journal` and `/journal/show` are in `middleware.ts`'s `protectedRoutes`; `isAdmin` is resolved server-side and re-enforced on the export route, so hiding the Export Excel button is defence-in-depth rather than the only gate.
- **Dead ends worth knowing about:** `usr` param is parsed but unused; `schedules` and `noteList` props are passed to `JournalForm` and never read; `allExpanded` state is written by `handleExpandAll`/`handleCollapseAll` but never read (the buttons actually toggle nothing outside the attendance card, since the other two collapsibles have independent state); `Swal` import in `journal-form.tsx`, `grade` prop in `AttendanceGrid`, `classValue` prop and the modal flatpickr `onChange` in `KbmEditor`, and the `Flatpickr` import in `attendance-grid.tsx` are all unused.