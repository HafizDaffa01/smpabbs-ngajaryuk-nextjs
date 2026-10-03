# src/app/(dashboard)/export/

The admin "Backup & Export Data" screen: a server page that reads teacher
attendance for one academic period and hands it to a large client island, which
renders one of three views (waktu / lokasi / gambar), writes corrections back
via `POST /api/export/backup-save`, and offers two destructive deletes. An
`ExportTargets` card row above the grid offers the three server-side downloads.

| File | Lines | Kind |
|---|---|---|
| `page.tsx` | 253 | `async` Server Component (no `'use client'`), `export const dynamic = 'force-dynamic'` |
| `backup-client.tsx` | 1133 | `'use client'`; exports `default BackupClient` plus the named `ExportTargets` component |

**The exports are CSV and ZIP — not xlsx.** `xlsx` is not imported anywhere in
this folder; SheetJS only appears in the two *import* routes
(`/api/schedule/import`, `/api/admin/import`) and `/api/journal/export`.

## Responsibility

- **Filter** by academic period (`1-2` … `12-1`), year, data type, and teacher
  name search — all via a plain `GET` form to `/export` (no client router, no
  `useSearchParams`).
- **Waktu view (default):** an editable teacher × day grid of check-in *times*
  (`HH:MM`), with a per-teacher `TOT` column, a "Scan & Simpan Perubahan" bulk
  save, an "Auto Save" toggle, an "A-Z / Z-A" sort button, and the two delete
  flows.
- **Lokasi view:** one row per teacher showing only the *first* record in the
  period (lokasi / alamat / waktu / akurasi).
- **Gambar view:** a responsive card grid (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`)
  of `absensis.foto` thumbnails, click to open in a new tab.
- Provide three server-side download links: attendance-weighted CSV by period,
  full-year GPS/location CSV, and a ZIP of every attendance photo.

## Design

**Server page + one client island, with `Map` objects crossing the boundary.**
`page.tsx` does the auth guard, the four Supabase reads, the period→date-range
math, the day-list generation, the teacher-name filter, renders the `PageHeader`
+ filter `Card`, then renders `<ExportTargets>` and `<BackupClient>` with six
props (`page.tsx:242-249`):

| Prop | Type | Built by |
|---|---|---|
| `teachers` | `{id, name}[]` (non-admin, name-filtered) | `profiles.select('id,name').eq('is_admin', false).order('name')` → `.filter(includes searchQuery)` |
| `days` | `string[]` of `YYYY-MM-DD` | `while (current <= end) days.push(current.toISOString().split('T')[0])` (102-108) |
| `attendanceMap` | `Map<user_id, Map<'YYYY-MM-DD', AbsensiRecord>>` | `absensis` rows keyed on `absen.waktu.split('T')[0]` (131-138) |
| `period`, `year` | `string`, `string` | query params, defaults `'1-2'` and `new Date().getFullYear()` |
| `dataType` | `'waktu' \| 'lokasi' \| 'gambar'` (typed `string`) | `params.type \|\| 'waktu'` |

`Map` props work because this is a Server→Client boundary within the same
React render (not a `fetch` boundary), so non-serializable values are fine.
`AbsensiRecord` is re-declared locally at `page.tsx:119-130` and includes
`value?: string` — the field `src/types`' `Absensi` is missing (see
`src/types/codemap.md`). `backup-client.tsx:51-61` declares a *third* copy,
`AttendanceRecord`, which additionally drops `unit`.

**The period model is duplicated, not imported.** `page.tsx:25-38` declares its
own `PERIODS` array of 12 `{value, label}` pairs keyed `'1-2'` … `'12-1'`, and
`/api/export/export-waktu/route.ts` and `/api/export/backup-save/route.ts` each
re-parse that same `'N-M'` string independently. `src/lib/period-system.ts`
already exports a `PERIODS` table (keys `jan_feb` … `des_jan`) plus
`getCurrentPeriod()`, `getPeriodDateRange()` and `formatPeriodLabel()` — this
folder uses none of them, though `src/components/period-badge.tsx` and
`(dashboard)/prevSmes/page.tsx` do.

**21st→20th date math, implemented three times.**

```ts
const [startMonth, endMonth] = period.split('-').map(Number)
const startDate = `${year}-${pad2(startMonth)}-21`
const endDate   = `${year}-${pad2(endMonth)}-20`
```

`page.tsx:97-99`, `export-waktu/route.ts:41-42`, `backup-save/route.ts:40-41`.
No year rollover handling: for `'12-1'` the end date (`YYYY-01-20`) precedes the
start date (`YYYY-12-21`), so the `while (current <= end)` loop at
`page.tsx:105` produces **zero days** and the page renders an empty grid. The same
inversion exists in `export-waktu` (`route.ts:57-59`) and in `backup-save`'s
(unused) range.

**`backup-client.tsx` is one 1133-line file with two exported components and 17
`useState` hooks in `BackupClient`.** State inventory: `gridData`,
`previousSeed`, `saving`, `editingCell`, `autoSave`, `sortAsc`, `toasts`,
`hasUnsavedChanges`, `deleteLock`, `showDeleteModal`, `showDeletePeriodModal`,
`captchaCode`, `captchaInput`, `deleteType`, `deletePeriodMonth`,
`deletePeriodYear`, `deleteWithImage`, `deletingAll`, `deletingPeriod`, plus
`toastIdRef` and `toastTimersRef`. (`ExportTargets`, the sibling export, holds
its own `pending` state and timer map.) The grid is seeded by `useMemo`
(`buildGrid`, 273-292) and re-seeded by a render-phase reset (320-323) instead
of a `setState` inside `useEffect`.

**Three mutually exclusive render branches, no tabs.** `dataType === 'waktu'`
returns the editable grid (612-987), `=== 'lokasi'` returns the location table
(989-1052), `=== 'gambar'` returns the photo grid (1054-1121), and anything else
returns an `EmptyState` inside a `Card` ("Tipe data tidak dikenal", 1123-1132).
Since `dataType` arrives as a prop and the filter form submits, switching views
is a full server re-render, not a client state change.

**Cell editing pattern: click-to-edit, commit on blur, optional auto-save.**
`handleCellClick` (451) stores `editingCell = `${teacherId}-${day}`` (via
`getCellKey`); the cell then renders an `<input type="time">` with `autoFocus`,
`defaultValue={value}`, `onBlur={handleCellBlur}`, Enter → `.blur()` and
`onClick` → `stopPropagation()` so the cell's own `onClick` does not re-fire.
`handleCellBlur` (458) trims, writes to `gridData`, calls `markUnsaved()`, and
if `autoSave` is on, calls `saveCell` immediately.

**A locally re-implemented toast system.** `backup-client.tsx:359-372` copies
the shared `toast-provider` queue semantics (id ref, 3s `TOAST_TTL_MS`) but
renders its own `TOAST_TONES` map (90-95: `border-*-border bg-*-bg text-*-text`
plus a lucide icon and an ARIA `role`) inside a `pointer-events-none fixed
inset-x-4 top-20 z-9999` strip (580-601). `<ToastProvider>` from
`@/components/toast-provider` is in the root layout and would have worked. The
Bootstrap `.alert.alert-*` markup is gone.

**Unsaved-changes guard.** A `beforeunload` listener (440-449) that calls
`e.preventDefault(); e.returnValue = ''` when `hasUnsavedChanges`. There is no
in-app route-change guard, so an internal navigation discards edits silently.

**Delete-All CAPTCHA is a 5-digit `Math.random()` code shown in the modal.**
`generateCaptcha` (508-513) sets `captchaCode` to
`Math.floor(10000 + Math.random() * 90000)`; a wrong guess sets `deleteLock`
and clears it after `300000` ms (521). The code is displayed to the same user in
the same modal, so it prevents accidents, not a determined caller — and the lock is
client state only, so a refresh bypasses it.

**All three views are DS v2 now.** `waktu` and `lokasi` render `TableScroll` +
`Table`/`TableHead`/`TableCell` (with sticky `No` / `Nama` / `TOT` columns),
`gambar` renders a responsive grid of bordered thumbnail cards, the deletes are
`Dialog` modals, and the unknown-type branch is an `EmptyState`. The old
`.row.g-3` / `.card` / `.img-thumbnail` / `.table.table-bordered` Bootstrap
markup and the `.card-brutalist` page wrapper described in
`docs/brutalist-design-spec.md` §4.6 are historical — that layer was deleted
from `globals.css`.

## Data Flow

**Read path (server, one render per filter change).**

```
GET /export?period=1-2&year=2026&type=waktu&search=budi
  page.tsx
    await cookies() → createClient(cookieStore)
    auth.getUser()             → redirect('/login')   if no user
    profiles.select('is_admin')→ redirect('/unauthorized') if not admin
    profiles.select('id,name').eq('is_admin', false).order('name')   → teachers
    absensis.select('waktu').order('waktu',desc).limit(1000)          → years[]
    [startMonth,endMonth] = period.split('-')
    startDate = YYYY-MM-21 ; endDate = YYYY-MM-20
    while (current <= end) days.push(...)                            → days[]
    absensis.select('*').gte('waktu',startDate).lte('waktu',endDate+'T23:59:59').order('waktu')
    attendanceMap: user_id → (waktu.split('T')[0] → row)             → Map
    teachers.filter(name.includes(search))                           → filteredTeachers
  render <PageHeader/> → <Card>(filter form) → <ExportTargets/> → <BackupClient … />
    useMemo([teachers, days, attendanceMap]) →
      gridData[teacher.id][day] = waktu ? toLocaleTimeString('id-ID',{HH:MM}) : ''
```

Note the seed is recomputed from `attendanceMap` whenever any of the three props
change identity — which is on every server re-render, so **any filter change
discards unsaved edits** even though `hasUnsavedChanges` was set.

**Write path (client → API → table).**

```
"Scan & Simpan Perubahan"  → handleSaveAll
  data = [{user_id, date, value}] for every non-empty gridData cell
  POST /api/export/backup-save {period, year, data}
    for each row: absensis.select('id').eq('user_id',…).gte('waktu',day T00)
                  .lt('waktu', day T23:59:59).maybeSingle()
      existing → .update({ value }).eq('id', …)
      else      → profiles.select('name') then
                  .insert({ user_id, nama, unit:'SMP ABBS Surakarta',
                            lokasi:'-', alamat:'-', foto:null, akurasi:null,
                            waktu: `${date}T00:00:00`, value })
  → { success: true }

auto-save toggle on        → handleCellBlur → saveCell (same endpoint, 1-row payload)
```

Auto-save issues **one HTTP request and two DB round-trips per blurred cell**,
sequentially per cell, and shows a success toast for each.

**Delete paths.**

```
"Hapus Semua Absensi"  → generateCaptcha() + showDeleteModal
  handleDeleteAll: captchaInput !== captchaCode → deleteLock=true (5 min), modal closes
                   else POST /api/export/delete-all { with_image: deleteType === 'all' ? 1 : 0 }
                        → absensis.delete().neq('id', 0)

"Hapus per Bulan"     → showDeletePeriodModal (month select 1-12, year number, "Ikut hapus file gambar fisik?")
  handleDeleteByPeriod: missing month/year → toast 'Pilih bulan dan tahun'
                        else POST /api/export/delete-by-period { month, year, with_image }
                          → absensis.delete().gte('waktu', YYYY-MM-01).lte('waktu', YYYY-MM-31T23:59:59)
```

**Download targets (`ExportTargets` cards; a click creates an anchor).**

| Title | Badge | Href | Produces |
|---|---|---|---|
| Rekap Jam Kehadiran | CSV | `/api/export/export-waktu?period=${period}&year=${year}` | `rekap_waktu_{period}_{year}.csv` |
| Rekap Lokasi GPS | CSV | `/api/export/export-lokasi?year=${year}` | `rekap_lokasi_{year}.csv` |
| Rekap Foto Absensi (gambar target) | ZIP | `/api/export?type=zip` | `uploads.zip` |

Each is a `<Button>` in a bordered card with a `Badge` for the format, a lucide
icon, and a scope line (period label · year). `handleExport` (171-190) builds
and clicks a same-origin `<a download>`, then holds a `pending` state for
`EXPORT_PENDING_MS` (6s) so a second click is refused while the browser fetches.
The hrefs are unchanged from the old three `<a href>` tags.

### `/api/export/*` endpoint table

| Endpoint | Method | Params | Auth | Table | Response |
|---|---|---|---|---|---|
| `/api/export` | GET | `type=csv` (+`month`,`year`) | admin | `absensis` | `text/csv`, `absensi_{year}_{month}.csv`; 404 `Tidak ada data` |
| `/api/export` | GET | `type=zip` | admin | `absensis` (`.not('foto','is',null)`) | jszip → `application/zip`, `uploads.zip`; 404 `Tidak ada foto` |
| `/api/export` | GET | any other `type` | admin | — | 400 `Invalid type` |
| `/api/export/export-waktu` | GET | `period`, `year` (both required) | admin | `profiles` (non-admin), `absensis` | `text/csv`, `rekap_waktu_{period}_{year}.csv`; 400 / 404 `Tidak ada data guru` |
| `/api/export/export-lokasi` | GET | `year` (required) | admin | `absensis` (whole year) | `text/csv`, `rekap_lokasi_{year}.csv`; 400 / 404 `Tidak ada data` |
| `/api/export/backup-save` | POST | JSON `{period, year, data:[{user_id,date,value}]}` | admin | `absensis`, `profiles` | `{success:true}`; 400 `Periode, tahun, dan data harus diisi` |
| `/api/export/delete-all` | POST | JSON `{with_image}` | admin | `absensis` | `{success:true, message}` |
| `/api/export/delete-by-period` | POST | JSON `{month, year, with_image}` | admin | `absensis` | `{success:true, message}`; 400 `Bulan dan tahun harus diisi` |
| `/api/export/pdf/rekap-presensi` | GET | `class`, `semester`, `year` | admin | `students`, `attendances` | `application/pdf`; 400/401/403/404 |
| `/api/export/pdf/rekap-kbm` | GET | `class`, `semester`, `year` | admin | `notes`, `schedules` | `application/pdf`; 400/401/403 |

Every one of the ten handlers repeats the same preamble verbatim:
`await cookies()` → `createClient(cookieStore)` → `auth.getUser()` → 401
`Unauthorized` → `profiles.select('is_admin').single()` → 403 `Forbidden`, and
ends with `catch → 500 { error: 'Terjadi kesalahan server' }`. The two
`pdf/*` handlers are `route.tsx` (not `.ts`) because they contain JSX.

**`export-waktu` weighting.** For each teacher × day it finds the first matching
record with `absensis.find(a => a.user_id === … && a.waktu >= dayT00 && <= dayT23)`
and pushes `record?.value || 'A'`, then accumulates `S`→1, `I`→0.5, `A`→0 into
a `Total` column. So a day with **no record is indistinguishable from an
explicit absence** in the CSV. Also `find` inside a double loop makes it
O(teachers × days × absensis) — a full re-scan of the result set per cell.

**`/api/export?type=zip`.** `const JSZip = (await import('jszip')).default`
(dynamic import, Node runtime), then for every row with a `foto` it
`new URL(foto)` → takes `url.pathname.split('/').pop()` as the archive filename →
`fetch(foto)` → `blob()` → `arrayBuffer()` → `folder.file(pathname, Buffer…)`
inside a `uploads/` folder, with a per-image `try/catch` that only
`console.error`s. `zip.generateAsync({type:'nodebuffer'})`. There is no
de-duplication of filenames and no cap on archive size, so N rows pointing at the
same object produce N identical entries.

## Integration Points

**Upstream (imports).** `page.tsx`: `@/utils/supabase/server` (`createClient`),
`next/headers` (`cookies`), `next/navigation` (`redirect`), lucide-react,
`./backup-client`. `backup-client.tsx`: `react` hooks, `lucide-react`,
`@/lib/utils` (`cn`), and the `@/components/ui/*` primitives (`badge`, `button`,
`card`, `dialog`, `empty-state`, `input`, `table`) — no Supabase, no `@/types`.
Neither file imports `xlsx` or `jszip` (the ZIP is server-side).

**Downstream (consumers).** `page.tsx` → `backup-client.tsx`; `backup-client.tsx`
→ 4 API routes; `ExportTargets` → 3 download endpoints. Nothing else in
`src/` imports from this folder. The route is reached from the teacher nav
(`/export`, label "Export Data", `src/components/teacher-nav.tsx:55`) and from
the admin dashboard, and `middleware.ts` lists `/export` in both
`protectedRoutes` and `adminRoutes`.

**Layout note.** `src/app/(dashboard)/export/` sits **inside** the `(dashboard)`
route group, so it renders inside `TeacherShell` → `AppShell` → `TeacherNav`
plus `Scripts`, with no page-local shell. (The old claim that it sat outside the
group and re-created its own `.min-vh-100.bg-body` / `.container` / `.card-brutalist`
wrapper is stale — both the group membership and that CSS layer changed in DS v2.)

**Known discrepancies / bugs.**

- **Period `'12-1'` renders an empty page.** `endDate` (`YYYY-01-20`) < `startDate`
  (`YYYY-12-21`) makes the day loop yield nothing — in `page.tsx:105`,
  `export-waktu/route.ts:59`, and the unused range in `backup-save/route.ts:40-41`.
- **`handleSort` does not sort.** It only flips `sortAsc` and shows a toast
  (`backup-client.tsx:503-506`); the render order is still `teachers.map(...)`
  (722) over the prop array, which arrives name-sorted from Postgres. The toast
  also reads `sortAsc` *before* the state update, so its label is inverted
  relative to the button text (667-670).
- **`deleteType` is dead.** Initialised to `null` (336) and only ever
  `setDeleteType(null)` (536) — no control sets it to `'all'` or `'data'`,
  so `with_image: deleteType === 'all' ? 1 : 0` (531) always sends `0`. The
  "Hapus Semua" dialog has no image checkbox at all; only the per-month dialog has
  one (`deleteWithImage`).
- **`with_image: 1` deletes nothing.** Both delete routes `console.log` "Image
  deletion requested but not implemented in serverless environment" and return
  `success: true` regardless — the checkbox is a no-op that reports success.
- **`<input type="time">` values are written into `absensis.value`**, whose column
  is `value CHAR(1) CHECK (value IN ('S','I','A'))` (`supabase/schema.sql:50`). A save of
  `"07:15"` violates the CHECK and the whole `backup-save` request 500s; a blank
  is skipped by `if (value)` in `handleSaveAll` but not by `saveCell` (guarded by
  `if (autoSave && trimmed)`). `src/types`' `Absensi` omits `value` entirely, so
  no local type raised this at compile time.
- **The `TOT` column is not a total.** `backup-client.tsx:729` counts only cells
  whose hour is `< 7` (`h < 7`), so a teacher checked in at 07:30 is not counted
  at all — the column header itself says so (619).
- **`gridData` is re-seeded from props on every render pass** whose
  `teachers`/`days`/`attendanceMap` identity changed (313-323), silently discarding
  edits; the `beforeunload` guard does not cover in-app navigation, so
  `/export` filter changes lose work without a prompt.
- **Auto-save fires a request per cell** and a success toast per cell, and each
  `backup-save` row costs 1 `select` + (1 `update` | 1 `profiles.select` +
  1 `insert`) — so typing a period's worth of times is hundreds of sequential
  round-trips. `backup-save` also parses `period`/`year` into `startDate`/
  `endDate` and then never uses them.
- **`lokasi` and `gambar` views only use `records[0]`** (or all records for
  `gambar`) out of a whole period, and the record order is whatever
  `attendanceMap`'s insertion order gives — so "Lokasi" shows an arbitrary
  period day, not the latest.
- **`delete-by-period` uses day `31` as the month end** (`route.ts:39-40`), so
  February deletes into March 2-3. `export-lokasi` similarly uses
  `${year}-12-31` (harmless) and `/api/export?type=csv` uses `-31` too
  (`route.ts:37-38`).
- **CSV is joined with a bare `,`** and no quoting/escaping
  (`row.join(',')`) in all four CSV routes, so a teacher name or address
  containing a comma or newline corrupts the file. Excel will also mis-detect the
  encoding since no BOM is written.
- **`/api/export?type=csv` is unreachable from the UI** — none of the three
  `ExportTargets` hrefs uses it (`/api/export?type=zip` is the only `/api/export`
  link). The branch (and the `absensi_{year}_{month}.csv` format) is dead code.
- **Local type duplication:** `AbsensiRecord` (`page.tsx:119`) vs
  `AttendanceRecord` (`backup-client.tsx:51`) vs `Absensi` in `src/types`;
  the local `PERIODS` array vs `@/lib/period-system`'s; the local toast queue vs
  `@/components/toast-provider`; and the period→date math repeated in three
  files.
- **`export const dynamic = 'force-dynamic'`** plus a `GET`-form filter means
  every filter click is a full server render and a full re-read of
  `absensis` for the window — acceptable, but it means the page cannot be
  statically rendered or cached.
- The old `.ring-2` / `.ring-primary` editing-cell highlight is gone; the editing
  state is now carried by the `<input type="time">` itself plus sticky column
  styling (`bg-surface-card` + `z-10`/`z-20` on the `No` / `Nama` / `TOT` columns).
