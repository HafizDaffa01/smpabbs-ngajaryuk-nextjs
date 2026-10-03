# src/app/prevSmes/show/

## Responsibility

Read-only **KBM recap** for a class over a semester, paired with the same period's student absence log. Unlike `/prevSmes/presensi` (a matrix), this page is a **chronological list**: one card per date, each containing the KBM notes written that day, plus a second section listing every `S`/`I`/`A` mark recorded that day. Two view modes:

- `view=semester` — the whole semester date range.
- `view=daily` — a single chosen date (KBM is date-scoped; see the caveat in "Data Flow").

Single file: `page.tsx` — Async Server Component, 251 lines, exports `dynamic`, `generateMetadata`, default `RekapShowPage`.

## Design

### Route config

- `export const dynamic = 'force-dynamic'`.
- `generateMetadata({ searchParams })` → `title: params.class ? \`Rekap KBM Kelas ${params.class} - NgajarYuk\` : 'Rekap KBM - NgajarYuk'`.

### Parameter resolution

```ts
const grade     = (params.class ?? '').toUpperCase()
const semester  = params.semester ? parseInt(params.semester) : new Date().getMonth() <= 6 ? 1 : 2
const year      = params.year     ? parseInt(params.year)     : new Date().getFullYear()
const viewType  = params.view  ?? 'semester'
const selectedDate = params.date ?? new Date().toISOString().split('T')[0]
```

`searchParams` is typed `{ class?, semester?, year?, view?, date? }`. As on the sibling page, `usr` is **not** declared — the form field `/prevSmes/page.tsx` sends is ignored, and `auth.getUser()` is the authority.

**Date range:**

```ts
const startMonth = semester === 1 ? 1 : 7
const endMonth   = semester === 1 ? 6 : 12

const startDate = viewType === 'daily' ? selectedDate : `${year}-${pad2(startMonth)}-01`
const endDate   = viewType === 'daily' ? selectedDate : `${year}-${pad2(endMonth)}-${endMonth === 6 ? '30' : '31'}`
```

June's end day is hard-coded to `'30'`, every other month to `'31'` — so February always ends at `31` in semester mode. `const carbonDate = new Date(selectedDate)` is computed on line 47 and then **never used** (dead local, presumably a leftover from a date-library port).

### Queries

1. `auth.getUser()` → `redirect('/login')`.
2. Students: `students.select('*').order('name')`, with `.ilike('grade', \`${grade}%\`)` for grades `7`/`8`/`9` (Leadership cohorts) and `.eq('grade', grade)` otherwise — the third occurrence of this branch in the app.
3. `attendances.select('*').in('student_id', studentIds).eq('year', year).gte('month', startMonth).lte('month', endMonth).in('value', ['S','I','A'])`. **The `.in('value', …)` filter is what makes this an absence log**: empty cells are never stored in `attendances`, so the query returns exactly the non-present days.
4. `notes.select('*').eq('class', grade).gte('date', startDate).lte('date', endDate)` — scoped by the **class** and the resolved date range, which is why this recap is date-aware while the presensi recap is month-range-aware.
5. `schedules.select('*').or(\`class_name.eq.${grade},class_name.eq.${gradeLevel}\`)` where `gradeLevel = grade.replace(/[^0-9]/g, '')` — so class `7A` also matches the bare `7` Leadership rows. **`schedulesByDay` is built from this result and then never rendered** (dead query).

### Derived structures

```ts
const absentsByDate: Record<string, { name: string; value: string }[]> = {}
// key = `${att.year}-${pad2(att.month)}-${pad2(att.day)}`
// name resolved per row via students?.find(s => s.id === att.student_id) ?? 'Unknown'   ← O(n) per row

const kbmByDate = new Map<string, typeof kbmData>()   // date → Note[]
const schedulesByDay = new Map<string, typeof schedules>()   // unused
```

Unlike `prevSmes/presensi`, the summary counters here are not accumulated — the per-date lists are rendered directly.

### Render

- `.min-vh-100.bg-body > main.container.pb-5 > .card-brutalist`.
- Header: `.section-label` `REKAP_KBM`, `<h1>Rekap KBM - Kelas {grade}</h1>`, `<p class="text-muted">Semester {semester} - Tahun {year}</p>`, `<Link href="/prevSmes" className="btn-brutalist-outline">Kembali</Link>`.
- **View toggle** (two `<Link>`s, no JS):
  - `/prevSmes/show?class=<g>&semester=<n>&year=<n>&view=semester` → `Semester`
  - `/prevSmes/show?class=<g>&semester=<n>&year=<n>&view=daily&date=<d>` → `Harian`
- **Date picker** (only when `viewType === 'daily'`): `<input type="date" id="date" defaultValue={selectedDate} form="dateForm" className="brutalist-input">` bound to a hidden `<form id="dateForm" action={\`/prevSmes/show?…&view=daily\`} method="GET" className="hidden">` with hidden `class`/`semester`/`year`/`view` inputs — the same form-attribute pattern as the presensi page's month picker. The native `<input type="date">` emits `YYYY-MM-DD`, matching `notes.date`.
- **Section 1 — `JURNAL_KBM`:** `.mb-5` block with `.section-label` `JURNAL_KBM` + `<h2 class="h5 mb-3 text-white">Jurnal KBM</h2>`, then `d-flex flex-column gap-3` of one `.card-brutalist` per `kbmByDate` entry. Each card body has an `<h5>` with the `id-ID` long date (`weekday`, `year`, `month`, `day`) and, per note, `<p class="text-main fw-medium">{note.subject} - {note.time}</p>` followed by `<p class="text-muted">{note.note}</p>` (raw text, **no HTML escaping concern because React escapes it**, and no markdown rendering). Empty → `"Tidak ada data KBM untuk periode ini."`
- **Section 2 — `PRESENSI_SISWA`:** same pattern, `.section-label` `PRESENSI_SISWA` + `<h2>Presensi Siswa</h2>`, one card per `absentsByDate` key with a `<ul class="d-flex flex-column gap-1">` of `<li>{abs.name} - <span class="fw-medium">{abs.value === 'S' ? 'Sakit' : abs.value === 'I' ? 'Izin' : 'Alpha'}</span></li>`. Per-card fallback `"Tidak ada presensi untuk tanggal ini."` and a global fallback `"Tidak ada data presensi untuk periode ini."`

## Data Flow

```
GET /prevSmes?class=7A&usr=<uuid>                    (plain form submit)
  → GET /prevSmes/show?class=7A&usr=<uuid>[&semester=&year=&view=&date=]
        cookies() → createClient
          auth.getUser()
          students    .select('*').order('name')          (+ ilike/eq grade)
          attendances .in(student_id).eq(year).gte(month).lte(month).in(value, ['S','I','A'])
          notes       .eq(class).gte(date, startDate).lte(date, endDate)
          schedules   .or(class_name.eq.<grade>, class_name.eq.<gradeLevel>)   ← fetched, unused
```

- No API routes, no client components, no fetch calls. Every navigation is a document GET.
- Both sections are read-only — there is no edit path from this page; writing happens in `/journal/show`.

**Behavioural caveat in `view=daily`:** `startDate`/`endDate` collapse to `selectedDate`, which correctly narrows the **KBM** query to one day. The **attendance** query, however, is built from `startMonth`/`endMonth` only (it uses `attendances.day`/`month`, not `date`), so switching to `Harian` narrows the KBM list to a single date while the `Presensi Siswa` section still lists absences for the whole semester. The user can therefore click a date in the picker and see exactly one day's KBM above a full-semester absence log.

## Integration Points

- **Auth:** covered by `middleware.ts`'s `/prevSmes` prefix; no admin check, so any authenticated user can read any class's KBM and absence data (both `notes` and `attendances` RLS policies are `auth.role() = 'authenticated'` for SELECT).
- **Layout:** sibling of `src/app/(dashboard)/` → root layout only; the `← Kembali` link is the sole in-page navigation.
- **Sibling:** `/prevSmes/presensi/page.tsx` (the matrix view) — both pages share the semester/year/view query-string convention and the `getMonth() <= 6 ? 1 : 2` default.
- **Tables:** `notes` (`class`, `subject`, `date`, `time`, `note`, `checked`, `teacher_id`), `attendances` (`student_id`, `day`, `month`, `year`, `value`), `students` (`id`, `name`, `grade`), and `schedules` (queried but unused).
- **Value semantics:** `'S'` → *Sakit*, `'I'` → *Izin*, `'A'` → *Alpha*, rendered here as Indonesian words rather than the bare letters the grid uses.
- **Domain libs (not imported):** `@/lib/period-system` provides `getSemesterMonths(semester)` which would replace the duplicated `startMonth`/`endMonth` arithmetic.
- **PDF/report siblings:** the same data is available in generated reports through `src/app/api/export/pdf/rekap-kbm/route.tsx` and `src/components/pdf/rekap-kbm-pdf.tsx` (`@react-pdf/renderer`) — that is the path for producing a printable version of what this page shows on screen.
- **Design system:** design spec §4.8 prescribes one `.card-brutalist` per day for both sections, a brutalist date input, and the Semester/Harian toggle in the header — the code matches.