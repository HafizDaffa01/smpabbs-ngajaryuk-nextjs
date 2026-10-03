# src/components/pdf/

Two `@react-pdf/renderer` document components, 214 + 160 lines. Both are
`'use client'`, both wrap a `<Document>` in a `<PDFDownloadLink>`, and **neither
is imported by anything in the repository** — they are dead code that a
byte-identical copy of their JSX lives inside two Route Handlers.

| File | Default export | Props interface | Lines |
|---|---|---|---|
| `rekap-presensi-pdf.tsx` | `RekapPresensiPDF` | `RekapPresensiPDFProps` (line 58) | 214 |
| `rekap-kbm-pdf.tsx` | `RekapKBMPDF` | `RekapKBMPDFProps` (line 61) | 160 |

## Responsibility

- Render a **student attendance recap** (`RekapPresensiPDF`) as an A4 landscape
  PDF: one row per student, one column per month in the requested range, cell
  content formatted `S:n I:n A:n`, plus per-student S/I/A columns and a
  grand-total row.
- Render a **KBM / journal recap** (`RekapKBMPDF`) as an A4 landscape PDF: a
  "Jadwal Pelajaran" section grouping the class's `schedules` by day, then one
  section per date listing the `notes` recorded that day.

Both are pure presentational renderers — no fetch, no Supabase, no state.

## Design

**Client-side `PDFDownloadLink` (not `renderToBuffer`).** Each component returns

```tsx
<PDFDownloadLink
  document={ <Document>…</Document> }
  fileName={`rekap_presensi_kelas_${grade}_semester_${semester}_${year}.pdf`}
>
  {({ loading }) => (loading ? 'Membuat PDF...' : 'Download PDF')}
</PDFDownloadLink>
```

so the whole `@react-pdf` renderer ships to the browser and the visitor clicks a
link; the file name is built in the component.

**The `fontFamily: 'Inter'` + `StyleSheet.create` block is duplicated three
times.** All three copies register the same woff2 from Google Fonts at module
scope:

```ts
Font.register({
  family: 'Inter',
  fonts: [{ src: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff' }],
})
```

The same `StyleSheet.create` block is then declared in the file. All three
copies (both components + both handlers) register the identical Inter woff2
from `fonts.gstatic.com` at module scope. Verified identical
(whitespace-stripped `diff`) between `rekap-presensi-pdf.tsx:5-56` and
`src/app/api/export/pdf/rekap-presensi/route.tsx:7-58`, and between
`rekap-kbm-pdf.tsx:5-59` and
`src/app/api/export/pdf/rekap-kbm/route.tsx:7-61`.
Because `Font.register` is a module-level side effect and these are `'use client'`
modules, registering twice in one bundle is at best a no-op and at worst a
thrown duplicate-family error.

**Props contract (the only public API of this folder).**

`RekapPresensiPDFProps`:

| Prop | Type | Used for |
|---|---|---|
| `grade` | `string` | title text + `fileName` |
| `semester` | `number` | title text + `fileName` |
| `year` | `number` | title text, `fileName`, and `new Date(year, m-1)` for month labels |
| `students` | `{ id: number; name: string }[]` | row identity (`key={student.id}`) and name cell |
| `attendanceData` | `Record<number, Record<number, Record<number, string>>>` | `attendanceData[studentId][month][day] → 'S'\|'I'\|'A'` |
| `startMonth` / `endMonth` | `number` | `months = Array.from({length: endMonth-startMonth+1}, (_,i)=>startMonth+i)` (line 77) |

`RekapKBMPDFProps`:

| Prop | Type | Notes |
|---|---|---|
| `grade`, `semester`, `year` | `string`, `number`, `number` | title + `fileName` |
| `kbmByDate` | `Map<string, {date, subject, time, note, teacher?}[]>` | `dates = Array.from(kbmByDate.keys()).sort()` (line 70) |
| `schedules` | `{day, period, subject, teacher: string\|null, start_time: string\|null, end_time: string\|null}[]` | optional, defaults to `[]`; bucketed into `schedulesByDay` (73-78) |

Note the `attendanceData` shape is a **three-level numeric index**
(`studentId → month → day`), which is why the handler has to build it by hand
and why `src/app/api/export/pdf/rekap-presensi/route.tsx:60` re-declares
`type AttendanceData = Record<number, Record<number, Record<number, string>>>`
rather than sharing one.

**Styling is all inline `@react-pdf` `StyleSheet` — none of the app's CSS
applies.** There is no `.brutalist-*` here, no Tailwind, no Bootstrap: page
padding 15, base fontSize 9, `tableHeader` background `#f3f4f6`, row rule
`#e5e7eb`, `summaryRow` background `#f9fafb` with a 2px `#000000` top border.
Column widths are computed inline as strings: name `12%`, months
`${78 / months.length}%` each, and S/I/A `10%` each — so 6 months fills
12+78+30 = 120% and the renderer will compress or overflow.

**A "present" count that counts the wrong thing.** `rekap-kbm-pdf.tsx:120`
(a verbatim copy at `route.tsx:124`):

```ts
// Count attendance for this date
const presentCount = notes.filter((n) => n.note && n.note.trim()).length
```

The comment says "attendance" but it counts notes with non-empty text, and the
heading renders `({presentCount} catatan)` — so the label is right and the
comment is wrong. It is also computed *inside* `dates.map`, i.e. once per date
over that date's notes only, which is correct for the heading.

## Data Flow

**The components' own flow is one-way: props → JSX → PDF bytes, entirely in the
browser.** Nothing reads from the database here, so a caller must supply
`attendanceData` / `kbmByDate` / `schedules` already assembled. The nearest
server-side analogue of that assembly is in the two Route Handlers:

**`GET /api/export/pdf/rekap-presensi?class=&semester=&year=`**
(`src/app/api/export/pdf/rekap-presensi/route.tsx`, 308 lines)

```
await cookies() → createClient(cookieStore)        (RLS/user-scoped)
auth.getUser()  → 401 if none
profiles.select('is_admin')  → 403 if not admin
grade = (searchParams.get('class') ?? '').toUpperCase()
semester = parseInt(?) or (new Date().getMonth() <= 6 ? 1 : 2)
year     = parseInt(?) or new Date().getFullYear()
startMonthBound/endMonthBound = semester === 1 ? [1, 6] : [7, 12]
students: select('*').order('name') — ilike `grade%` for '7'|'8'|'9', else eq
          → 404 'Tidak ada siswa di kelas ini' if empty
attendances: select('*').in('student_id', studentIds).eq('year', year)
             .gte('month', startMonthBound).lte('month', endMonthBound)
pivot into attendanceData[att.student_id][att.month][att.day] = att.value   (270-279)
renderToBuffer(<RekapPresensiDocument …/>)          ← the inlined copy
→ new NextResponse(new Uint8Array(buffer), {
    'Content-Type': 'application/pdf',
    'Content-Disposition': attachment; filename=rekap_presensi_kelas_${grade}_semester_${semester}_${year}.pdf
  })
catch → 500 { error: 'Terjadi kesalahan server' }
```

**`GET /api/export/pdf/rekap-kbm?class=&semester=&year=`**
(`src/app/api/export/pdf/rekap-kbm/route.tsx`, 252 lines) — same auth preamble,
then:

```
startDate = `${year}-${MM}-01`,  endDate = `${year}-${MM}-${endMonth === 6 ? '30' : '31'}`
notes:     select('*').eq('class', grade).gte('date', startDate).lte('date', endDate)
kbmByDate: Map<note.date, [{date, subject, time, note, teacher: note.teacher_id || undefined}]>
schedules: select('*').or(`class_name.eq.${grade},class_name.eq.${gradeLevel}`)
           where gradeLevel = grade.replace(/[^0-9]/g, '')
renderToBuffer(<RekapKBMDocument …/>)
→ same PDF Content-Type / Content-Disposition / 500 fallback
```

**Key structural point: the handlers do not import the components.** Each one
re-declares a plain (non-`'use client'`) function — `RekapPresensiDocument`
(`rekap-presensi/route.tsx:62-209`) and `RekapKBMDocument`
(`rekap-kbm/route.tsx:63-159`) — whose JSX is identical to the corresponding
component's `<Document>` subtree once whitespace is normalised (verified by
whitespace-stripped `diff`: the only difference is the surrounding
`PDFDownloadLink` / `fileName` / `{({loading}) => …}` wrapper in the component
files). Each handler also repeats the same `type AttendanceData` /
inline `kbmByDate` element type rather than sharing a type.

So the effective flow of a *real* PDF request is
`GET /api/export/pdf/*` → server handler → **inlined** document component →
`renderToBuffer` → `NextResponse` bytes, and `src/components/pdf/` sits beside
that path, unused.

## Integration Points

**Upstream imports.** Both files import only
`{ PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font }` from
`@react-pdf/renderer` (`package.json:16`, `^4.6.0`). Neither imports anything
from `@/lib`, `@/types`, `@/utils`, or any other project module.

**Downstream consumers: none.** `grep -rn "components/pdf" src/` → 0 hits.
`RekapPresensiPDF` and `RekapKBMPDF` have no import site, no dynamic
`import()` site, and no `next/link` target. Additionally,
`grep -rn "api/export/pdf"` across `src/` and `docs/` returns **only** the two
route files themselves — **no page, link, or button anywhere in the app points
at `/api/export/pdf/rekap-presensi` or `/api/export/pdf/rekap-kbm`**. Both the
client components and the server endpoints are therefore unreachable by UI, and
`src/app/prevSmes/presensi/page.tsx` (the natural consumer) contains no
download or PDF affordance at all.

**Related but distinct export paths that *are* wired up** (see
`src/app/export/codemap.md`): `POST/GET /api/export/export-waktu` and
`/api/export/export-lokasi` produce CSV, and `GET /api/export?type=zip` produces
a jszip archive of the `uploads` bucket. The PDF pair is the only export format
in the repo with no entry point.

**Known discrepancies / dead ends.**

- **~600 lines of duplicated, unreachable code.** Four implementations of two
  documents: two `'use client'` `PDFDownloadLink` components and two server
  document functions, with byte-identical JSX and identical `StyleSheet` /
  `Font.register` blocks.
- **Neither path is linked from any UI**, so the endpoints are only reachable by
  hand-typing the URL with `class`/`semester`/`year` query params — and the
  admin-only 403 makes even that admin-only.
- **`Font.register` runs at module scope in all four copies.** Consolidating to
  one document per report and importing it from the handler would fix both the
  duplication and the duplicate-registration risk.
- **Two different download mechanics for the same document**: browser-side
  `PDFDownloadLink` (components) vs. server-side `renderToBuffer` + attachment
  header (handlers). Whichever survives consolidation, the other must go.
- **`kbmByDate`'s `teacher` field is populated with a raw `notes.teacher_id`
  UUID** (`rekap-kbm/route.tsx:215`,
  `teacher: note.teacher_id || undefined`), and the component prints it
  directly (`(…)` after the subject) — so the PDF shows a UUID where a teacher
  name is expected. The component's own type calls it `teacher?: string`, which
  is true but semantically wrong.
- **`schedules` are matched with a loose `or()`** —
  `class_name.eq.${grade},class_name.eq.${gradeLevel}` where
  `gradeLevel = grade.replace(/[^0-9]/g, '')` — so `/api/export/pdf/rekap-kbm?class=7A`
  pulls every schedule whose `class_name` is `7A` **or** exactly `7`. The
  presensi endpoint has no equivalent broadening (it uses `ilike '7%'` for
  `students` only).
- **`endDate` for semester 1 is hard-coded to day `30`**
  (`rekap-kbm/route.tsx:198`) rather than derived, so a June 31 would be
  impossible by luck rather than by calculation.
- Column widths summing to >100% for 6 months (`12% + 78% + 3×10%`) means the
  S/I/A columns are laid out by the renderer's flex shrink, not by the
  percentages.
