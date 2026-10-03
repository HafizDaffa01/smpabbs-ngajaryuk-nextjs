# src/app/prevSmes/presensi/

## Responsibility

Read-only **student attendance recap matrix** for a class over a semester or a single month. Two view modes share one page and one query:

- `view=semester` — one column per month in the semester range, each cell holding the `S:n / I:n / A:n` counts for that month.
- `view=monthly` — one column per day of the chosen month, each cell tinted by the single mark for that day.

Both modes end with a per-student summary column (`S` / `I` / `A` totals across the whole queried range).

Single file: `page.tsx` — Async Server Component, 253 lines, exports `dynamic`, `generateMetadata`, default `RekapPresensiPage`.

## Design

### Route config

- `export const dynamic = 'force-dynamic'` — the output depends on cookies, query params and today's date.
- `generateMetadata({ searchParams })` → `title: params.class ? \`Rekap Presensi Kelas ${params.class} - NgajarYuk\` : 'Rekap Presensi - NgajarYuk'`.

### Parameter resolution

```ts
const grade        = (params.class ?? '').toUpperCase()
const semester     = params.semester ? parseInt(params.semester) : new Date().getMonth() <= 6 ? 1 : 2
const year         = params.year     ? parseInt(params.year)     : new Date().getFullYear()
const viewType     = params.view ?? 'semester'
const selectedMonth= params.month   ? parseInt(params.month)   : new Date().getMonth() + 1
```

`searchParams` is typed `{ class?, semester?, year?, view?, month? }` and awaited as a `Promise`. The `usr` field that `/prevSmes/page.tsx` puts in the form is **not** declared or read — the page authenticates with `auth.getUser()` instead, so a hand-edited `usr` has no effect.

**Semester → month bounds** (duplicated verbatim in `/prevSmes/show/page.tsx`):

```ts
const startMonthBound = semester === 1 ? 1 : 7
const endMonthBound   = semester === 1 ? 6 : 12
const startMonth = viewType === 'monthly' ? selectedMonth : startMonthBound
const endMonth   = viewType === 'monthly' ? selectedMonth : endMonthBound
```

Note the semester default is month-based, not school-calendar-based: months 0–6 (Jan–Jul) → semester 1, months 7–11 (Aug–Dec) → semester 2.

### Queries

1. `auth.getUser()` → `redirect('/login')`.
2. Students: `supabase.from('students').select('*').order('name')`, branching on grade — `['7','8','9']` → `.ilike('grade', \`${grade}%\`)`, otherwise `.eq('grade', grade)`. Same rule as `/journal/show/page.tsx`.
3. `studentIds = students?.map(s => s.id) ?? []`.
4. Attendance: `supabase.from('attendances').select('*').in('student_id', studentIds).eq('year', year).gte('month', startMonth).lte('month', endMonth)`. Note it filters by **`year`**, and by a month *range*, because `attendances` has no `date` column — only `day`/`month`/`year` (see `supabase/schema.sql`).

### Derived structures

```ts
const attendanceMap: Record<number, Record<number, Record<number, string>>> = {}  // [student_id][month][day] = value
const summary: Record<number, { S: number; I: number; A: number }> = {}          // per student
```

Both are pre-seeded with zeros for every student so the summary column never renders `undefined`.

### Render

- `.min-vh-100.bg-body > main.container.pb-5 > .card-brutalist`.
- Header (`.card-brutalist-header.d-flex.justify-content-between.align-items-center`): left side has `.section-label` `REKAP_PRESENSI`, `<h1 class="h3 mb-1 text-white">Rekap Presensi - Kelas {grade}</h1>`, `<p class="text-muted">Semester {semester} - Tahun {year}</p>`; right side is `<Link href="/prevSmes" className="btn-brutalist-outline">Kembali</Link>`.
- **View toggle** — two plain `<Link>`s (no client JS) that rebuild the whole query string:
  - `/prevSmes/presensi?class=<grade>&semester=<n>&year=<n>&view=semester` → `Semester`
  - `/prevSmes/presensi?class=<grade>&semester=<n>&year=<n>&view=monthly&month=<m>` → `Bulanan`
  Active one renders `btn-brutalist`, inactive `btn-brutalist btn-brutalist-outline`.
- **Month picker** (only when `viewType === 'monthly'`): a `<select id="month" defaultValue={selectedMonth} form="monthForm" className="brutalist-select">` listing 12 options labelled `new Date(year, m-1).toLocaleDateString('id-ID', { month: 'long' })`. It is bound to a sibling `<form id="monthForm" action={\`/prevSmes/presensi?class=…&view=monthly\`} method="GET" className="hidden">` carrying hidden `class`/`semester`/`year`/`view` inputs — the HTML *form attribute* trick, so changing the select submits the hidden form and navigates.
- **Table** (`.table-responsive > table.table-brutalist`):
  - Header cells: `Nama Siswa`, then per-mode day/month columns, then `Ringkasan`.
  - Semester mode columns: `Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i)` labelled with `toLocaleDateString('id-ID', { month: 'short' })` (e.g. `Jan`, `Feb`, …).
  - Monthly mode columns: `Array.from({ length: new Date(year, selectedMonth, 0).getDate() }, (_, i) => i + 1)`.
  - **Semester cell:** counts computed inline — `daysWithAttendance = Object.keys(monthData).length`, `sickDays`/`excusedDays`/`absentDays` filter for `'S'`/`'I'`/`'A'`. Renders a vertical flex of `S:n` (`text-primary-bold`), `I:n` (`text-warning`), `A:n` (`text-danger`), each suppressed when the count is 0; `'-'` in `text-muted` when the month has no marks at all.
  - **Monthly cell:** `className` is `bg-primary-light` / `bg-warning-light` / `bg-danger-light` according to `value`, and the cell shows the raw `S`/`I`/`A` letter in `fw-medium`, else `'-'`.
  - **Summary cell:** `.badge-brutalist.badge-brutalist-primary` `S: {n}`, `' | '`, `.badge-brutalist-warning` `I: {n}`, `' | '`, `.badge-brutalist-danger` `A: {n}`.
- There is **no empty state** for "no students in this class" — the table simply renders a header row with no body rows.

## Data Flow

```
GET /prevSmes?class=7A&usr=<uuid>          (plain form submit)
  → GET /prevSmes/presensi?class=7A&usr=<uuid>
        cookies() → createClient
          auth.getUser()
          students  .select('*').order('name')                 (+ ilike/eq on grade)
          attendances .in('student_id', ids).eq('year').gte('month').lte('month')
```

- Fully server-rendered; the only client-side behaviour is the native select/form submission.
- No API routes. No `dynamic` revalidation concerns because of `force-dynamic`.
- When the class has no students, `studentIds` is `[]` and the `.in('student_id', [])` clause matches nothing — the summary stays zeros and the body is empty.

## Integration Points

- **Auth:** `/prevSmes` is in `middleware.ts`'s `protectedRoutes`, so `/prevSmes/presensi` is edge-protected too (prefix match on `route + "/"`). No page-level admin check — any authenticated user can read any class's attendance.
- **Layout:** sibling of `src/app/(dashboard)/` → root layout only. The `← Kembali` link is essential here because no chrome provides navigation.
- **Navigation:** `<Link href="/prevSmes">Kembali</Link>` and the two view-toggle links; reached from the "Rekap Presensi Siswa" card in `/prevSmes/page.tsx`. The sibling recap page `/prevSmes/show/page.tsx` offers the same class of toggle with `view=semester|daily` instead of `monthly`.
- **Tables:** `students` (`id`, `name`, `progul`, `grade`), `attendances` (`student_id`, `day`, `month`, `year`, `value`).
- **Domain semantics of `value`:** `'S'` = sakit (sick), `'I'` = izin (excused), `'A'` = alpha (absent). The `CHECK (value IN ('S','I','A'))` constraint on `attendances.value` plus `idx_attendances_unique (student_id, day, month, year)` guarantee the matrix has at most one mark per student-day-month-year.
- **Design system:** design spec §4.8 prescribes `.table-brutalist` with `table-layout: fixed`, a sticky first column, per-month S/I/A badges and a `.status-bar`-style summary column. The implementation matches the badges and toggle but does **not** apply sticky positioning to the `Nama Siswa` column (the sticky-column pattern lives in `/journal/show`'s `AttendanceGrid` instead).
- **Adjacent domain lib (not used here):** `@/lib/period-system` already exposes `getSemesterMonths(semester)` returning `[1..6]` or `[7..12]`, which is exactly this page's semester/month-bound logic — it is not imported, so the bound arithmetic is duplicated a third time.