# src/app/(dashboard)/

## Responsibility

The teacher-facing route group. Next.js strips the parentheses from the URL, so
these folders resolve to plain top-level paths: `/`, `/journal`, `/absensi`,
`/schedule`, `/prevSmes`, `/export`, `/explorer`, `/profile`.

`layout.tsx` is the only shared file; each subfolder owns its own `codemap.md`
plus this index.

| File | Kind | Role |
|---|---|---|
| `layout.tsx` | Server Component | Wraps every child in `TeacherShell`, mounts `Scripts` |
| `page.tsx` | Async Server Component | Home route `/` — hero, hadith, quick links |

## Chrome boundary — read this before moving a route

`layout.tsx:20-31` returns `<TeacherShell>{children}<Scripts /></TeacherShell>`.

- `src/components/teacher-shell.tsx` resolves the teacher server-side
  (`cookies()` → `createClient` → `auth.getUser()`) and renders
  `src/components/app-shell.tsx` (collapsible sidebar rail, sticky topbar,
  mobile off-canvas drawer, `ThemeToggle`, `<main id="konten-utama">`). Nav
  items come from `src/components/teacher-nav.tsx`.
- `TeacherShell` **never redirects**. Signed-out visitors get the page with no
  chrome, which is why every page below keeps its own guard.
- `metadata` in `layout.tsx:4-9` sets the `%s | NgajarYuk` title template for
  the whole group.
- `Scripts` (`src/components/scripts.tsx`) owns the global SweetAlert2 palette
  so a popup opened from `/journal`, `/absensi` or `/profile` is themed
  regardless of which route opened it.

**Outside the group, at `src/app/`: `login/`, `error/`, `success/`,
`unauthorized/`.** These are deliberately chrome-free — moving one inside the
group would wrap it in the sidebar and topbar. `/login` is also the target of
every `redirect('/login')` below.

## Route table

| Route | `page.tsx` | Guard | Notable | Client island |
|---|---|---|---|---|
| `/` | async SC | `getUser` → `/login` (`:115-117`) | `metadata` `:85`; `profiles.name` → greeting `:119-127`; 10 hardcoded hadiths, `Math.random()` per render `:18-83` | none |
| `/journal` | async SC | `getUser` **+** `profiles` → `/login` (`:24-36`) | class list derived from distinct `schedules.class_name`, grouped by first char `:39-62`; GET form → `/journal/show` `:86`; `EmptyState` "Belum ada jadwal kelas" `:128` | none |
| `/journal/show` | async SC, `dynamic = 'force-dynamic'` `:22` | `getUser` → `/login`; missing `class` → `/journal` `:43-53` | `generateMetadata` from `searchParams.class` `:24-29`; reads `class, usr, month, year, day` `:34`; leadership grades use `ilike`/`or()` widening `:66-70, 82-86`; serializes `Map`s to plain objects before `:262-279` | `journal/show/journal-form.tsx` |
| `/absensi` | async SC | `getUser` → `/login` (`:46-48`) | `profiles.name` passed as a prop `:87`; three-step "Cara melakukan presensi" + device-permission side cards `:85-152`; no `EmptyState` | `absensi/absensi-form.tsx` |
| `/schedule` | **sync** SC, no guard, no `dynamic` | none — see quirks | exists only to put the client half behind `<Suspense>` `:45-51`; `ScheduleSkeleton` fallback `:21-43` | `schedule/schedule-browser.tsx` |
| `/schedule/import` | async SC | `getUser` → `/login`; `!profile.is_admin` → `/unauthorized` `:29-41` | admin-only; breadcrumb back to `/schedule` `:47-51` | `schedule/import-form.tsx` (imported from `../import-form`) |
| `/schedule/kelas` | async SC | `getUser` → `/login` (`kelas/page.tsx:47-51`) | per-class grid: rows = jam pelajaran 1–9, cols = Senin–Sabtu; off-slots from `VALID_LESSONS_BY_DAY`; bare-digit `class_name` = Leadership; "Mapel → Guru" summary below the grid | `schedule/kelas/kelas-content.tsx` |
| `/prevSmes` | async SC | `getUser` → `/login` (`:41-43`) | two GET forms, one per recap card, each with a hidden `usr` `:114-121`; same class-grouping code as `/journal` | none |
| `/prevSmes/show` | async SC, `dynamic = 'force-dynamic'` `:21` | `getUser` → `/login` (`:57-59`) | `generateMetadata` `:23-28`; reads `class, semester, year, view, date` `:42-48`; semester inferred from `getMonth() <= 6` `:63`; two `EmptyState`s "Belum ada jurnal KBM" `:307` / "Belum ada ketidakhadiran" `:357` | none |
| `/prevSmes/presensi` | async SC, `dynamic = 'force-dynamic'` `:30` | `getUser` → `/login` (`:82-84`) | `generateMetadata` `:32-36`; reads `class, semester, year, view, month` `:67-73`; `view` toggles semester vs monthly buckets `:90-97`; `EmptyState` "Belum ada siswa" `:328` | none |
| `/export` | async SC, `dynamic = 'force-dynamic'` `:23` | `getUser` → `/login`; `!is_admin` → `/unauthorized` `:58-70` | reads `period, year, type, search` `:49`; 12 payroll periods `:25-38`; years derived from `absensis.waktu` `:86-94`; period 12 wraps the year end `:97-99` | `export/backup-client.tsx` (exports `ExportTargets` + default `BackupClient`) |
| `/explorer` | async SC, `dynamic = 'force-dynamic'` `:25` | `getUser` → `/login`; `!is_admin` → `/unauthorized` `:39-51` | reads `path` `:30, 53-54`; `storage.from('uploads').list(path, { limit: 100 })` `:88-92`; `FileBrowser` streamed separately so storage latency shows a skeleton `:79-115`; breadcrumb builder `:117-150` | `explorer/explorer-client.tsx` (exports type `ExplorerEntry`) |
| `/profile` | async SC | `getUser` → `/login` **+** `profiles` → `/login` `:23-35` | `Avatar` + `Admin`/`Guru` badge in the header `:44-54`; serialized `profile` + `email` → `ProfileForm` `:58` | `profile/profile-form.tsx` |

## The Server/Client boundary

Every route here is an async Server Component that does three things in order:
1. `createClient(await cookies())` → `auth.getUser()` → `redirect('/login')`,
2. optionally a `profiles` read → `redirect('/unauthorized')` for admin routes,
3. Supabase reads, then a hand-off of plain serializable props to a
   `'use client'` island that owns every `fetch`.

`src/utils/supabase/server.ts` is a `createServerClient` with a no-op `setAll`,
so session refresh belongs to `middleware.ts`, not to these pages.

`/schedule` is the one exception: `schedule/schedule-browser.tsx:55-64`
documents the reason in a comment — `TeacherShell` is an async Server Component
and a `'use client'` module cannot import one, so the page must stay an RSC;
`useSearchParams()` still needs the `<Suspense>` boundary.

## Data sources (via `src/app/api/`, all POST/fetch from the islands)

- `/api/absensi` — `absensi/absensi-form.tsx:395`
- `/api/journal/save-all`, `/save-note`, `/export` — `journal-form.tsx:194, 227, 321`
- `/api/schedule` (+ `?class=&day=`) — `schedule-browser.tsx:87, 109`
- `/api/schedule/preview`, `/api/schedule/import` — `import-form.tsx:46, 87`
- `/api/profile`, `/api/profile/password` — `profile-form.tsx:73, 133`
- `/api/export/export-waktu`, `export-lokasi`, `/api/export`,
  `/api/export/backup-save`, `delete-all`, `delete-by-period` — `backup-client.tsx:147-555`
- `/api/explorer/*` — POST-only handlers in `src/app/api/explorer/`

## UI primitives

This subtree uses `PageHeader`, `Card`, `Button`/`ButtonLink`, `Badge`,
`Input`/`Select`/`Field`, `Avatar`, `BarChart`, `StatCard`, `Table`,
`Skeleton`/`SkeletonTable`, `EmptyState`, `FeedbackBanner`, `Dialog`,
`Dropzone`, `ThemeToggle` (via the shell), plus `readDsToken` from
`swal-theme` (`absensi-form.tsx:36`) for themed alerts.

**Read `src/components/ui/codemap.md` for their APIs, variants and prop
contracts** — do not re-derive it here. Tokens are `--ds-*`, bridged into
Tailwind by the `@theme inline` block in `src/app/globals.css`.

## Quirks and traps

1. **Duplicate auth guards are deliberate.** The layout does not redirect, so
   each page owns its guard. Do not "clean up" the repetition.
2. **`/schedule` has no guard and is not in `middleware.ts` `protectedRoutes`**
   (`middleware.ts:37-46` lists `/admin`, `/absensi`, `/journal`, `/prevSmes`,
   `/profile`, `/backup`, `/explorer`, `/export`). An unauthenticated visitor
   reaches the page; the client fetch is what actually fails. Same for
   `/schedule/import`, which is not covered by the list either and relies on its
   own page-level `is_admin` check (it is also missing from `adminRoutes`,
   `middleware.ts:64-71`).
3. **File inputs must stay in the DOM.** `schedule/import-form.tsx:126-149`
   keeps the real `<input type="file" name="file_v94">` inside the `<form>`,
   hidden by `Dropzone` with `sr-only` (`src/components/ui/dropzone.tsx:88-99`),
   never `display:none`. That is what makes `formData.get('file_v94')` at
   `import-form.tsx:33-34` resolve. Do not move the input outside the form.
4. **`/explorer` create-folder and upload forms are broken.** They are
   `method="GET"` against `formAction="/explorer/folder"` and
   `/explorer/upload` (`explorer/page.tsx:172-225`), but the real handlers are
   POST-only and live under `/api/explorer/` (`folder/route.ts:5`,
   `upload/route.ts:5`). The `formAction` paths omit the `/api` prefix, so
   submitting navigates to a route that does not exist (404) and can never be a
   successful POST. Unfixed. `explorer-client.tsx:139, 204-205` has the same
   problem for `/explorer/delete-file` / `/explorer/delete-folder`, and the
   rename control is a plain `href={`/explorer/rename?path=...`}` link
   (`:120`) pointing at a POST-only handler.
5. **Geofence constants are hardcoded** in `absensi-form.tsx:38-40`
   (`SCHOOL_LAT/LON`, `MAX_RADIUS = 1000`); the submit handler re-checks
   `isInsideRadius` client-side before POSTing (`:376-393`), which is a UX gate,
   not a security one.
6. **`params.usr` from the query string is trusted** by `/journal/show`
   (`:49`) and passed onward in the `/prevSmes` GET forms
   (`prevSmes/page.tsx:121`). It is not compared against `user.id`.
7. **`/journal` drops grades starting with `0`, `k`, `a`**
   (`journal/page.tsx:102`) and renders pure-numeric classes as
   "Leadership Class N" (`:110-113`). The sibling logic in `prevSmes/page.tsx`
   is a near-duplicate.
8. **Legacy CSS is gone.** The `LEGACY · BOOTSTRAP-PARITY CSS` and
   `LEGACY · BRUTALIST DESIGN SYSTEM` blocks were removed in the DS v2
   migration; `src/app/globals.css` now carries only the `--ds-*` token
   namespace, the `@theme inline` bridge, and the `[data-ds-shell]`-scoped
   shell base. Do not reference any brutalist or Bootstrap-parity class.
