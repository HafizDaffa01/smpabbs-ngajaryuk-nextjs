# src/app/(dashboard)/schedule/

## Responsibility

Read-only timetable browser: filter the `schedules` table by class and/or weekday and render it as a table. This is the page the teacher nav's "Jadwal" entry and the admin TS Manager screens point at.

Three files, plus a `kelas/` subfolder:
- `page.tsx` — a **Server Component** (51 lines) exporting `metadata` and owning the `<Suspense>` boundary plus its skeleton fallback.
- `schedule-browser.tsx` — the `'use client'` half, default export `SchedulePageContent`. Separate module on purpose: `TeacherShell` is an async Server Component that reads `cookies()`, and a `'use client'` module cannot import one.
- `import-form.tsx` — the aSc Timetables v9.4 uploader, imported by `import/page.tsx` from `../import-form`.
- `kelas/` — the per-class sibling view at `/schedule/kelas`; see `kelas/codemap.md`.

`/schedule` and `/schedule/kelas` are two readings of the same `schedules` table — a flat per-teacher list and a 9×6 per-class grid. They cross-link in both directions through their `PageHeader` actions.

## Design

### Component decomposition

```
export default function SchedulePage()            // RSC: metadata + boundary only
  └─ <Suspense fallback={<ScheduleSkeleton />}>
       └─ <ScheduleBrowser />                     // 'use client', does the work
```

The split exists because `useSearchParams()` requires a `<Suspense>` boundary in App Router. `ScheduleSkeleton` renders `Skeleton` / `SkeletonTable` placeholders inside a `Card`; the old `.card-brutalist` skeleton with the text `'Memuat data...'` is gone. Loading state in the client half is now a `Badge` reading `Memuat…` plus a `SkeletonTable` swap.

`page.tsx` performs no `auth.getUser()` gate and no Supabase read; authentication for this page is the concern of `middleware.ts` and `/api/schedule` (see "Data Flow").

### State

| State | Initial value | Purpose |
|---|---|---|
| `selectedClass` | `searchParams.get('class') \|\| ''` | class filter, `''` = all |
| `selectedDay` | `searchParams.get('day') \|\| 'Monday'` | weekday filter, defaults to Monday |
| `schedules` | `[]` (typed `ScheduleRow[]` = `ScheduleRecord & { id: number }`) | the table rows |
| `classes` | `[]` (typed `string[]`) | distinct `class_name` values for the dropdown |
| `loading` | `true` | shows the `SkeletonTable` / `Memuat…` badge |
| `scheduleError` | `null` | row-fetch failure, rendered in a `FeedbackBanner tone="error"` |
| `classError` | `null` | class-list fetch failure, rendered in a dismissible `FeedbackBanner tone="error"` |

`const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']` — the filter list is hardcoded English weekday names, matching how `schedules.day` is stored (see `DAY_MAP` in `@/lib/bell-schedule`, which maps the Indonesian aSc headers to exactly these strings). Sunday is not offered. A local `DAY_LABELS` record renders the Indonesian names (Senin…Sabtu) for the table caption and `scopeLabel`.

### Two effects

**1. Schedule fetch** — deps `[selectedClass, selectedDay]`:

```ts
const params = new URLSearchParams()
if (selectedClass) params.set('class', selectedClass)
if (selectedDay)   params.set('day', selectedDay)
const response = await fetch(`/api/schedule?${params.toString()}`)
const data = await response.json()
if (!response.ok) throw new Error(data.error || 'Gagal memuat jadwal')
setSchedules(data.schedules || [])
```

Both filters are always sent once set — `selectedDay` defaults to `'Monday'`, so **the page can never show all days at once**; omitting it requires clearing the day select, which the `<select>` does not offer (there is no "all days" option, unlike the class select's `"Semua Kelas"`).

**2. Class list fetch** — deps `[]`, on mount only:

```ts
const response = await fetch('/api/schedule')       // unfiltered
const allClasses = [...new Set((data.schedules || []).map(s => String(s.class_name)))].filter(Boolean)
setClasses(allClasses)
```

This downloads the **entire** `schedules` table just to populate the dropdown — there is no distinct-classes endpoint.

**Error handling:** both effects `console.error` *and* record the message in state (`scheduleError` / `classError`), which renders as a `FeedbackBanner tone="error"` — the row banner is dismissible. So a failed request no longer degrades silently into the empty state.

### URL sync

`handleFilterChange()` (bound to the filter `<form>`'s `onSubmit`, which calls `preventDefault()`) rebuilds the query string and does `router.push('/schedule?class=…&day=…')`. Because the effects already refetch on state change, this push exists only to make the view shareable/bookmarkable.

### Render

- Container: `flex flex-col gap-5 bg-surface-canvas text-text-primary` → `PageHeader` (title "Jadwal Mengajar", breadcrumb `Beranda` → `/`, `actions` = `ButtonLink` "Import Jadwal" → `/schedule/import`) → `Card` with `CardHeader` (`CardTitle` "Jadwal Mingguan" + `CardDescription` explaining "Periode", and a `Badge` showing `Memuat…` or `N sesi`) and `CardContent`.
- Filter form: `flex flex-wrap items-end gap-3` with two `Field` + `Select` controls — `#class` (`Field label="Kelas"`, options: `"Semua Kelas"` with `value=""`, then each class name) and `#day` (`Field label="Hari"`, the six English weekday names), plus a `Button type="submit" variant="secondary"` "Terapkan".
- Table: `TableScroll` + `Table className="min-w-[760px]"` with `TableCaption` `Jadwal mengajar {scopeLabel}` and columns **Kelas · Hari · Periode · Mapel · Guru · Waktu**.
  - Row key `sched.id`.
  - Kelas rendered raw; Hari in a `Badge variant="neutral"`; Periode in a `Badge variant="accent"` (title "Jam pelajaran ke berapa pada hari ini").
  - Mapel: `sched.subject_display || sched.subject` — `subject_display` is the human-friendly canonical name written by the importer (`SUBJECT_DISPLAY_MAP` in `@/lib/bell-schedule`: `Sprt → SPORT`, `Cv → Civics`, `BI → Indonesian`, …), falling back to the raw aSc sheet code.
  - Guru: `sched.teacher || '-'`.
  - Waktu: `` `${formatJam(start)} - ${formatJam(end)}` `` (a `formatJam` helper doing `value.slice(0, 5)` on the Postgres `TIME` seconds) prefixed by a lucide `Clock` icon, when both are present, else `'-'`.
- Three mutually exclusive body branches: `scheduleError` banner, `classError` banner, then `loading` → `SkeletonTable rows={6} cols={6}`, `schedules.length === 0` → `EmptyState` (title "Belum ada jadwal", lucide `CalendarPlus`, an `Import Jadwal` `ButtonLink`), otherwise the table. The old `colSpan={6}` "Memuat data..." rows and the FontAwesome `fa-inbox` empty state are gone.

## Data Flow

```
/schedule (client)
  ├─ on mount            GET /api/schedule                  → distinct class_name list
  └─ on class|day change GET /api/schedule?class=&day=     → schedule rows
```

### `src/app/api/schedule/route.ts` (GET)

- Uses `createClient(request)` from `@/utils/supabase/middleware` — the request-cookie adapter that also returns the mutable `response` — rather than the `cookies()`-based helper in `@/utils/supabase/server`.
- `auth.getUser()` → **401** `{ error: 'Unauthorized' }`.
- Optional filters: `classParam` → `.eq('class_name', classParam)`, `dayParam` → `.eq('day', dayParam)`.
- Always ordered `.order('class_name').order('day').order('period')`.
- Returns `{ schedules }`; DB error → **500** with `error.message`; catch → **500** `'Terjadi kesalahan server'`.

### `src/app/api/schedule/route.ts` (POST) — same file, not used by this page

Admin-gated (`profiles.is_admin`, else **403**) single-row insert requiring `class_name`, `day`, `period`, `subject` (**400** otherwise), defaulting `subject_display` to `subject.toUpperCase()` and nulling `teacher`/`start_time`/`end_time`. Returns `{ schedule }`.

The editor UI for this lives elsewhere: `src/app/admin/tsmanager/ts-manager-client.tsx` + `PUT/DELETE /api/schedule/[id]`.

## Integration Points

- **Auth:** `/schedule` is **not** in `middleware.ts`'s `protectedRoutes` list (`/admin`, `/absensi`, `/journal`, `/prevSmes`, `/profile`, `/backup`, `/explorer`, `/export`). An unauthenticated visitor can therefore render the page shell; `/api/schedule` returns 401 and the table falls back to the empty state. There is also no page-level auth gate.
- **Layout:** the route lives under the `(dashboard)` group (`src/app/(dashboard)/schedule/`), so it renders inside `(dashboard)/layout.tsx` → `TeacherShell` → `AppShell` → `TeacherNav` plus `Scripts`. The old claim that it was a sibling rendering the root layout only no longer holds; `src/components/navbar.tsx` / `mobile-nav.tsx` were deleted in the DS v2 migration.
- **Nav:** the teacher nav links `/schedule` as "Jadwal" (lucide `CalendarDays`, `src/components/teacher-nav.tsx:48`). Admin editing lives in `src/app/admin/tsmanager/` and is reached from the admin shell's `/admin` link.
- **Tables:** `schedules` (`class_name`, `day`, `period`, `subject`, `subject_display`, `teacher`, `start_time`, `end_time`).
- **Sibling route:** `/schedule/import` (`page.tsx` + `import-form.tsx`) is the admin-only writer for this table.
- **Consumers of `schedules`:** `(dashboard)/journal/page.tsx` and `(dashboard)/prevSmes/page.tsx` both derive their class pickers from `select('class_name')`; `(dashboard)/journal/show/page.tsx` and `(dashboard)/prevSmes/show/page.tsx` read full rows; `src/app/api/absensi/route.ts` queries it by `ilike('teacher', …)` to build the WhatsApp lesson digest.
- **Design system:** DS v2 composition — `PageHeader`, `Card` family, `Field`/`Select`, `TableScroll`/`Table*`, `Badge`, `FeedbackBanner`, `EmptyState`, `Skeleton*`, lucide icons. The `.card-brutalist` + `JADWAL_MENAJAR` composition from `docs/brutalist-design-spec.md` §4.4 is historical.
- **Data-shape note:** rows are typed `ScheduleRow = ScheduleRecord & { id: number }`, imported from `@/lib/bell-schedule`; `@/journal/show/journal-form.tsx` declares its own local `Schedule` type.