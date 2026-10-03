# src/app/admin/

Admin-only control panel for NgajarYuk Next: platform statistics, teacher/account
management, teacher-attendance backup (view + delete), and Excel import for students
and teachers.

**All seven routes are now gated three times over** — by the root `middleware.ts`,
by `layout.tsx`, and by an inline `is_admin` check in each page (see
[Auth layering](#auth-layering--three-copies-of-the-same-check)).

Files: `layout.tsx`, `page.tsx`, `dashboard-client.tsx`, `user-table.tsx` + the five
sub-routes `absensi/`, `teachers/`, `import/`, `import-teachers/`, `tsmanager/`.
**`layout.tsx` exists and is new** (it did not before 2026-09-30).

## Current state — design-system v2 migration (2026-09-30)

Every page under `/admin` now renders through the primitives in
`src/components/ui/` and the `--ds-*` tokens. No Bootstrap, no brutalist class,
no FontAwesome, no raw hex survives in this subtree. The temporary
"legacy token bridge" block that used to sit in `.admin-shell` in
`src/app/globals.css` has been **deleted** — the admin pages no longer read any
`--bg-*` / `--text-*` / `--dark-*` legacy variable.

The server/client split is unchanged: every `page.tsx` is still an async Server
Component that runs the auth guard + its own Supabase reads and passes plain
serializable props to a `*-client.tsx` / `*-form.tsx` island.

| Page | Server component does | Client island renders |
|---|---|---|
| `/admin` | counts (`profiles` ×2, `students`, `absensis`, `notes` ×2) + 7-day `absensis.waktu` window + `users` + `studentsByClass` + `currentKey` | `PageHeader` slot (clock `#clock` / `#date` / `#greeting` targets), 4 `StatCard`s, class-roster strip, weekly `BarChart`, `UserTable`, shortcut grid |
| `/admin/teachers` | `profiles.select('*').eq('is_admin', false)` | filter row (`Input` + `Select`), `Table` in `TableScroll` (sticky header), kebab `Dropdown`, delete `Dialog` |
| `/admin/absensi` | `profiles` + `absensis.select('year, month')` | 4 summary `StatCard`s, filter fields, 31-day CSS-grid recap with legend, detail `Table` |
| `/admin/import` | guard only | `Dropzone` + preview `Table` + submit `Button` |
| `/admin/import-teachers` | guard only | `Dropzone` + format badge + preview `Table` |
| `/admin/tsmanager` | `profiles.select('*')` | filter row, mapel badges per teacher, assignment `Dialog` (structured rows + raw JSON) |

Two behaviours worth knowing about:

- **`window.show*Popup` still exists.** `dashboard-client.tsx` keeps registering
  `showTeachersPopup`, `showAbsenciPopup`, `showClassesPopup` and
  `showStudentsPopup`, and the clock/greeting interval, exactly as before. The
  stat cards are now stretched overlay buttons inside the client island instead
  of `onClick` handlers in the Server Component.
- **`#searchUsers` is still inert.** The dashboard search box has no handler and
  `UserTable` receives no search prop — that predates the migration and was
  left alone deliberately (UI-only migration). It is the one known dead control
  in this subtree.

## Responsibility

- Provide the admin navigation chrome (`AdminShell`: fixed sidebar, topbar,
  mobile drawer) for every `/admin/*` route.
- Re-verify the session and admin role once, at the layout level, before any
  admin page renders.
- Aggregate school-wide numbers (total guru, total absensi, total kelas, total siswa)
  and surface drill-down SweetAlert2 popups for each stat card.
- Manage the `profiles` account list: create teacher, edit name/email/phone/password,
  promote/demote admin, delete user (with its `absensis` rows).
- Browse and purge teacher attendance records in `absensis`
  (single record, whole month/year, or everything, optionally deleting storage photos).
- Bulk-load `students` rows and `profiles` rows (auth users + `mapel` JSONB) from `.xlsx`
  workbooks.
- Provide the entry-point card grid that links to the other admin tools and to
  `/schedule`, `/export`, `/explorer`.

## `layout.tsx` — the new file (52 lines)

```tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AdminShell } from '@/components/admin/shell'

export const metadata = { title: 'Admin', description: 'Panel administrasi NgajarYuk' }

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('name, is_admin').eq('id', user.id).single()

  if (!profile?.is_admin) redirect('/unauthorized')

  return (
    <AdminShell user={{ name: profile.name?.trim() || user.email || 'Administrator',
                        email: user.email ?? null }}>
      {children}
    </AdminShell>
  )
}
```

Design points:

- **Async Server Component** (no `'use client'`). `AdminShell` is a client
  component, but `children` is passed as a slot, so the pages still render on the
  server and stream as a child — the client bundle only carries the shell.
- **`LayoutProps<'/admin'>`** is the Next 16 typed-routes global (generated into
  `.next/types/routes.d.ts`), the same helper `src/app/layout.tsx` uses as
  `LayoutProps<'/'>`. It is not declared in `src/types/`.
- **Own `export const metadata`** — `{ title: 'Admin', description: 'Panel
  administrasi NgajarYuk' }`. Because the root layout has no title *template*
  and `(dashboard)/layout.tsx` defines one only for its own group, this title
  is not suffixed. Note `page.tsx` also exports its own
  `metadata = { title: 'Admin Dashboard - NgajarYuk' }`, and the **page wins**
  over the layout, so the layout's `metadata` is effectively dead.
- **The guard is a layout-level gate, deliberately duplicated.** The file's own
  comment says so: *"Auth is re-verified here as a layout-level gate. The
  individual admin pages keep their own guards — this is defence in depth, not a
  replacement."* It is byte-for-byte the same sequence every page already runs
  (`cookies()` → `createClient` → `auth.getUser()` → `redirect('/login')` →
  `profiles.select('name, is_admin')` → `redirect('/unauthorized')`).
- **The `profiles` select is slightly wider than the pages'**: pages select only
  `is_admin`; the layout selects `name, is_admin` because it needs the display
  name for the shell.
- **`name` falls back three ways**: `profile.name?.trim() || user.email ||
  'Administrator'`. `email` is `user.email ?? null`. Both match the
  `AdminUser = { name: string; email?: string | null }` type declared in
  `src/components/admin/sidebar.tsx`.
- **No `ToastProvider` here** — it is already in the root layout, so admin pages
  *do* have `useToast()` available even though none of them call it.

### The old codemap's claim, corrected

The previous version of this file stated: *"No `layout.tsx` exists in this
folder"* and *"Because `src/app/admin/` is *not* inside the `(dashboard)` route
group, these pages do not get `Navbar` / `MobileNav` / `Scripts` — only the root
layout. Each page therefore re-creates its own shell."*

**Both halves are now false.** `layout.tsx` exists, and the folder no longer
relies on being outside the route group. The *reason* the new file was added is
stated in its own doc comment:

> *"Dedicated admin shell. `(dashboard)/layout.tsx` only wraps `/`, so without
> this every other route renders with no navigation chrome."*

The accurate statement today: `/admin/*` gets `AdminShell` (sidebar + topbar +
drawer) from `layout.tsx`; it still does **not** get `Navbar` / `MobileNav` /
`Scripts`, because `AdminShell` is a different shell, not a wrapper around them.

## Q: Does `admin/layout.tsx` duplicate `(dashboard)/layout.tsx`, or supersede it?

**It neither duplicates nor supersedes it — it is a second, independent shell
covering a disjoint set of routes. There are now two competing app shells, but
they never render on the same route, so there is no double chrome today.**

| | `(dashboard)/layout.tsx` | `admin/layout.tsx` (new) |
|---|---|---|
| Routes covered | **`/` only** — the group contains just `page.tsx` | `/admin` + all 5 sub-routes |
| Chrome | `TeacherShell` → `AppShell` (rail + topbar) → `Scripts` | `AdminShell` → `<aside>` / drawer / `<Topbar>` → `<main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">` |
| Style | legacy brutalist + Bootstrap grid + FontAwesome `<i>` | `lucide-react` icons, `--ds-*` tokens, collapsed rail, breadcrumb, theme toggle |
| Theme toggle | none | `ThemeToggle` in the topbar |
| Scoped CSS | none | the `[data-ds-shell]` block in `globals.css`, which both shell roots opt into |
| Guard | none | `getUser()` + `profiles.is_admin` |

Verified: `grep -rn "components/navbar\|components/mobile-nav\|components/scripts" src/`
returns hits **only** in `src/app/(dashboard)/layout.tsx`. So `AdminShell`
replaces nothing that admin previously had — admin never had them.

**But the two shells are genuinely competing**, in three concrete ways:

1. **Two `<main>` landmarks, two nav systems, two icon systems, two CSS
   strategies.** A user moving between `/` and `/admin/teachers` gets a
   completely different chrome, different fonts/colors, and different nav
   affordances. There is no shared shell abstraction, no shared nav config, and
   no shared focus-ring primitive — `AdminShell` re-declares its own
   `focus-ring` markup on a dozen hand-written buttons instead of using
   `ui/button.tsx`.
2. **The other 8 route groups still have no shell at all.** `absensi/`,
   `explorer/`, `export/`, `journal/`, `login/`, `prevSmes/`, `profile/`,
   `schedule/`, `success/`, `unauthorized/`, `error/` get only the root layout,
   i.e. exactly the "no navigation chrome" problem `admin/layout.tsx` was written
   to fix. `AdminShell` is hardcoded to admin (its `NAV_GROUPS` are all
   `/admin/*`, its user block says "Administrator", it links to `/profile`), so
   it is not yet a reusable app shell.
3. **The legacy-chrome seam inside `/admin` is closed (2026-09-30).** All six
   pages used to nest their own
   `<div className="min-vh-100 bg-body"><main className="container pb-5">` plus a
   `.card-brutalist` header with a `← Kembali` link inside `AdminShell`'s
   `<main>`. They now emit `PageHeader` + `Card` primitives and let the shell own
   the layout, and the `globals.css` "TEMPORARY BRIDGE" block that existed to keep
   that markup legible has been deleted.

## Auth layering — three copies of the same check

| Layer | Where | Mechanism |
|---|---|---|
| Middleware | `middleware.ts:64-86` | `adminRoutes = ['/admin','/backup','/explorer','/export','/admin/import','/admin/import-teachers']`, matched as `path === route \|\| path.startsWith(route + '/')`; on failure `redirect('/unauthorized')`. Because `'/admin'` is in the list, its prefix rule already covers **all six** admin pages. |
| Layout (new) | `layout.tsx:21-40` | `cookies()` → `createClient` → `auth.getUser()` → `profiles.select('name, is_admin')` → redirects. Runs **before** any page, once per navigation. |
| Page | each of the 6 `page.tsx` | identical sequence, selecting only `is_admin` (lines ~14-32 in each). |

Three layers of the same query, two of them now redundant. The page-level copies
are the ones to delete first — they are the documented reason the layout was
called "defence in depth", but with the layout in place they cost an extra
`getUser()` + `profiles` round-trip per page render. Note the middleware covers
`/admin/teachers` and `/admin/tsmanager` only via the `'/admin'` prefix entry,
not via a dedicated entry.

## Design

**Server-component page + separate `-client.tsx` island (the dominant pattern).**
None of the six `page.tsx` files carry `'use client'`; all are `async` Server
Components that do the auth guard, run their own Supabase reads, and hand plain
serializable props down to a client island. `layout.tsx` follows the same
convention.

| Page | Island (client) | Lines |
|---|---|---|
| `page.tsx` (`/admin`) | `dashboard-client.tsx` (486), `user-table.tsx` (472) | 260 |
| `absensi/page.tsx` | `absensi/absensi-client.tsx` (893) | 65 |
| `teachers/page.tsx` | `teachers/teacher-table.tsx` (546) | 56 |
| `import/page.tsx` | `import/import-form.tsx` (239) | 49 |
| `import-teachers/page.tsx` | `import-teachers/teacher-import-form.tsx` (296) | 49 |
| `tsmanager/page.tsx` | `tsmanager/ts-manager-client.tsx` (911) | 56 |

**Guard boilerplate is duplicated verbatim in every page and in the layout**
(~20 lines each, see the table above).

**Page chrome comes from the shell.** Each page starts with `PageHeader`
(breadcrumb + the single `<h1>` + description + actions) and then composes
`Card`/`StatCard`/`Table`. No page renders its own `<main>`, container, or
`← Kembali` link any more — the sidebar and topbar breadcrumb cover that.

**`/admin` specifics (`page.tsx`, 260 lines).**
- Server queries: `head:true` counts for `profiles` where `is_admin=false` (`teachersCount`),
  `profiles` where `is_admin=true` (`adminsCount`), `students` (`studentsCount`),
  `absensis` (`absensiCount`), `notes` (`notesCount`) and `notes` where
  `checked = true` (`notesCheckedCount` — added for the "Jurnal Terisi" card);
  plus `absensis.select('waktu')` for the last 7 days (the chart's raw series).
  Then a full `profiles` list excluding `name = 'AdminABBS'` ordered
  `is_admin desc, name`; then `students.select('grade, name')` reduced on the
  server into `studentsByClass: Record<string, {name}[]>`.
- Computes `currentKey` server-side by walking a hard-coded 21st→20th period table
  (`['1','2'] … ['12','1']`) and returns e.g. `'1-2'`.
- The four stat cards live in `dashboard-client.tsx`, not in the Server Component.
  Three of them (Guru, Siswa, Absensi Hari Ini) are stretched overlay buttons that
  call `window.show*Popup`; Jurnal Terisi is static. The class roster popup is
  reachable from the "Lihat daftar kelas" button on the strip below the cards.
- The 7-day `waktu` series is bucketed **client-side** (Monday-first) so "hari
  ini" and the Sen–Min axis follow the viewer's clock rather than the server's.
  Until hydration the chart renders a `Skeleton` of the same height.
- A `#searchUsers` input is still rendered with no React state or handler, so it
  does not filter; `UserTable` receives no search prop. Known dead control.
- The table wrapper is `TableScroll` (`src/components/ui/table.tsx`), which
  replaced the never-defined `.table-responsive-wrapper`.

**`dashboard-client.tsx` (486 lines).** Two responsibilities: it *renders* the
stat cards / class strip / weekly chart, and one `useEffect`
(deps `[users, absensiCount, studentsByClass, currentKey]`) still does the old two jobs:
1. Installs the four popup functions on `window` (the stat-card buttons call them).
   Each builds an HTML string and opens
   `themedSwal().fire({ title, html, icon:'info', confirmButtonText:'Tutup',
   confirmButtonColor: <--ds-*-text token>, width: popupWidth(), padding:'20px',
   scrollbarPadding:false, didOpen })`. `popupWidth()` returns `95vw` ≤480px,
   `90vw` ≤768px, else `700px`. `showAbsenciPopup` links to
   `/export?period=${currentKey}`. The old `COLORS` object of raw hex is gone —
   colours are read from `--ds-*` tokens.
2. Runs `updateClock()` on a `setInterval(…, 1000)` that writes into DOM nodes by id
   (`#clock`, `#date`, `#greeting`) — the `PageHeader` placeholders (`--:--:--`, `--`,
   `Selamat datang!`) — and sets the greeting to Selamat pagi/siang/sore/malam + `, Admin!`.
   The interval is cleared on unmount.
- The popup HTML uses `.ny-pop*` classes (`.ny-pop-title`, `.ny-pop-muted`,
  `.ny-pop-value`, `.ny-pop-box`, `.ny-pop-scroll`, `.ny-pop-list`, `.ny-pop-item`,
  `.ny-pop-link`), which **are** defined in `globals.css` and are token-driven.
  They live outside the `[data-ds-shell]` shell base, which is why they resolve
  against `:root`/`.dark`.
- SweetAlert2 is imported as the npm package (`sweetalert2`) and is the only admin
  consumer of it; `src/components/scripts.tsx` calls `useSwalTheme()` to apply the
  design-system palette imperatively.
- Because the clock/greeting are still written via `document.getElementById`, they
  will silently no-op if those ids change in `page.tsx`.

**Design-system conformance** (`docs/brutalist-design-spec.md`): the brutalist
spec (§4.2 Admin Dashboard, §4.5 Admin Backup Absensi, §4.10 TS Manager) described
`.card-brutalist`, `.brutalist-input`, `.table-brutalist`, `.btn-brutalist`,
`.badge-brutalist`, `.modal-brutalist` and FontAwesome 6.4 icons. **None of that
applies here any more** — as of 2026-09-30 this subtree is built on
`src/components/ui/` (`Card`, `StatCard`, `Table`/`TableScroll`, `Button`,
`Input`/`Select`/`Field`, `Badge`, `Avatar`, `Dialog`, `Dropdown`, `EmptyState`,
`Skeleton`, `Dropzone`, `BarChart`, `FeedbackBanner`, `PageHeader`) plus lucide
icons. `border-radius: 0` is gone; radius comes from `--ds-radius-*`.

## Route & Feature Map

| Route | Who can access | Purpose |
|---|---|---|
| `/admin` | Signed-in user with `profiles.is_admin = true` | Dashboard: 4 stat cards with SweetAlert2 drill-downs, live clock/greeting, `UserTable` account management, admin action-card grid. |
| `/admin/teachers` | Admin | Teacher-only account table (`is_admin = false`) — add / edit / promote / delete. No inbound link from the admin pages; reachable from `AdminShell`'s sidebar and breadcrumb. |
| `/admin/absensi` | Admin | "Backup Absensi": filter + 31-day teacher grid + detail table over `absensis`; inline-edit `waktu`/`lokasi`; delete one / by period / all (with optional photo purge). |
| `/admin/import` | Admin | Upload `.xlsx` → client-side preview of first 10 rows → `POST /api/import-students` to upsert `students`. |
| `/admin/import-teachers` | Admin | Upload `.xlsx` → format detection (A/B) + preview → `POST /api/admin/import-teachers` to create/update auth users and `profiles.mapel`. |
| `/admin/tsmanager` | Admin | Full teacher management: role column, inline cell editing, `mapel` JSONB editor modal, search box. |

All six are covered by `middleware.ts` (`'/admin'` in `adminRoutes`, matched by
prefix) *and* by the new `layout.tsx` *and* by each page; Route Handlers under
`/api/admin/*` repeat the same `getUser()` + `profiles.is_admin` check and return
401/403 JSON.

## Data Flow

**Layout-level (new, runs once per `/admin/*` navigation).**
`layout.tsx` reads `cookies()` → `createClient(cookieStore)` → `auth.getUser()` →
`profiles.select('name, is_admin')`. Only `name` and `email` cross the server/client
boundary; the `AdminUser` prop is the shell's entire data contract.

**Server-render reads (page → Supabase, cookie-bound user client).**
Every page builds `createClient(cookieStore)` from `@/utils/supabase/server` (anon key +
`parseCookieHeader`), so RLS applies:

- `/admin`: 4 `count:'exact', head:true` queries → `profiles` (`is_admin=false`),
  `profiles` (`is_admin=true`), `students`, `absensis`; then `profiles.select('*')`
  `.neq('name','AdminABBS')` ordered `is_admin desc, name`; then
  `students.select('grade, name')`. Results become props: `users` → `UserTable` and
  `DashboardClient`, `absensiCount`/`studentsByClass`/`currentKey` → `DashboardClient`.
- `/admin/teachers`: `profiles.select('*').eq('is_admin', false).order('name')` → `TeacherTable`.
- `/admin/absensi`: `profiles.select('id, name').eq('is_admin', false).order('name')` →
  `teachers` prop; `absensis.select('year, month')` → deduped `years` / `months`
  (months sorted desc) → filter dropdown options.
- `/admin/import`, `/admin/import-teachers`: guard only, zero data queries.
- `/admin/tsmanager`: `profiles.select('*')` ordered `is_admin desc, name` (admins
  included) → `TsManagerClient`.

**Shell-level (new).** `AdminShell` performs **no** data fetching. It reads
`usePathname()` for active nav + breadcrumbs + drawer-derived state, and
`localStorage['admin-sidebar-collapsed']` for the rail. Logout is
`POST /api/auth/logout` (see below). The root layout additionally supplies
`ToastProvider` and a blocking theme script; the new topbar supplies the
`ThemeToggle` and the account `Dropdown`.

**Client mutations (island → fetch → Route Handler → Supabase).** All writes go over
`fetch()` to `/api/admin/*`; response bodies are `{ success }`, `{ imported, format }` or
`{ error }`, and each handler re-verifies `is_admin` before touching the DB:

- `POST /api/admin/teachers` → `auth.admin.createUser({ email, password, email_confirm:true })`
  then `profiles.insert({ id, name, is_admin:false, phone_num })`, with
  `auth.admin.deleteUser` rollback if the profile insert fails. Used by `UserTable`,
  `AddUserForm`, `TeacherTable`, `AddTeacherForm`, and `AddTeacherForm` (tsmanager).
- `PUT /api/admin/teachers/[id]` → updates `profiles.name` / `profiles.phone_num`, plus
  `auth.admin.updateUserById` for email and password.
- `DELETE /api/admin/teachers/[id]` → `absensis.delete().eq('user_id', id)`,
  `profiles.delete()`, `auth.admin.deleteUser(id)`.
- `PUT /api/admin/teachers/[id]/make-admin` / `remove-admin` → `profiles.update({ is_admin: true|false })`.
- `PUT /api/admin/teachers/[id]/mapel` (tsmanager only) → `profiles.update({ mapel })`.
- `GET /api/admin/absensi?year&month` → `absensis.select('*', {count:'exact'})`
  ordered `waktu desc`, `.range(offset, offset+limit-1)` with `limit=100`/`offset=0`
  defaults; returns `{ absensis, total }`.
- `PUT /api/admin/absensi/[id]` and `DELETE /api/admin/absensi/[id]` → the `[id]` handler
  implements `DELETE` only (deletes the `uploads` storage object derived from `foto`,
  then the row); the `PUT` used by inline edit lives on the collection route
  `/api/admin/absensi` (body `{ id, ...updates }`).
- `POST /api/admin/absensi/delete-all?with_image=0|1` → optional bulk
  `storage.from('uploads').remove(paths)`, then `absensis.delete().neq('id', 0)`.
- `POST /api/admin/absensi/delete-by-period` body `{ month, year, with_image }` →
  deletes rows and matching photos for one month/year.
- `POST /api/import-students` (multipart `file`) → loops **all** sheets,
  `sheet_to_json(sheet,{header:1})`, skips header rows (`nama`/`name`),
  `students.upsert({ name, grade: grade.toUpperCase() }, { onConflict:'name,grade' })`.
- `POST /api/admin/import-teachers` (multipart `file`) → parses sheet 0, detects format,
  maps subjects, creates/updates auth users + `profiles.mapel`, then **deletes every
  non-admin profile whose email is not in the imported set**.
- `POST /api/auth/logout` — called by **both** `src/components/admin/sidebar.tsx`
  (line 91) and `src/components/admin/topbar.tsx` (line 54) with byte-identical
  handlers, then `router.push('/login')` + `router.refresh()`.

**Refresh strategy.** `UserTable` and `TeacherTable` call `window.location.reload()` after
every successful mutation (full server re-render). Only `AbsensiClient` and
`TsManagerClient` patch local state (`setAbsensiData(prev => …)` / `setTeachers(prev => …)`).
Anywhere a page calls `router.refresh()` (e.g. after logout) the whole `AdminShell`
re-renders too, since it is above the page in the tree.

**Schema gotchas observed in the flow.**
- `profiles` has no `email` column in `supabase/schema.sql`
  (`id, name, phone_num, is_admin, mapel, created_at, updated_at`), yet `page.tsx` selects `*`
  and both tables render `user.email` — that column renders as `-` from server data
  (the edit modal round-trips email through `auth.admin.updateUserById` only).
  By contrast the **new layout** gets `email` from `supabase.auth.getUser()` /
  `user.email`, not from the `profiles` row, so the topbar and account dropdown
  show a real address where the old tables show `-`.
- `absensis` in `supabase/schema.sql` declares no `month`/`year`, but
  `absensi/page.tsx`, `/api/admin/absensi`, `/api/admin/absensi/delete-by-period` and the
  `AbsensiRecord` type all use them; nothing in this repo writes them
  (`/api/absensi` inserts only `user_id, nama, unit, lokasi, alamat, foto, waktu`).
  `src/app/export/page.tsx` instead derives years from `new Date(a.waktu).getFullYear()`.

## Integration Points

**Auth / gating**
- `middleware.ts` — `adminRoutes` list + `profiles.is_admin` lookup → `/login` /
  `/unauthorized` redirects; `config.matcher` covers `/admin/*`.
- `layout.tsx` — layout-level re-check (new).
- `@/utils/supabase/server` `createClient(cookieStore)` (anon key, RLS-scoped) in the
  layout, in every page, and in every `/api/admin/*` handler; `createServiceClient()`
  (service role) is **not** used here.

**Upward — the shell this folder renders inside**
- `@/components/admin/shell` → `AdminShell` — the *only* consumer of it.
- Which in turn owns `@/components/admin/sidebar` (`Sidebar`, `AdminUser`) and
  `@/components/admin/topbar` (`Topbar`), which pull in
  `@/components/ui/avatar` (`Avatar`), `@/components/ui/theme-toggle`
  (`ThemeToggle`) and `@/components/ui/dropdown` (all six `Dropdown*`).
- `@/components/ui/codemap.md` — inventory, variant tables and the
  `[data-ds-shell]` CSS-scoping caveat.
- `@/components/admin/codemap.md` — shell layout contract, nav table, a11y details.

**Downward — the design system this folder still does not use**
Grep-verified: **no file under `src/app/admin/` imports anything from
`@/components/ui/`.** Not `Button`/`ButtonLink`, not `Card`, not `Badge`, not
`Table`, not `Input`/`Textarea`/`Select`/`Field`, not `Dialog`, not `PageHeader`,
not `StatCard`, not `EmptyState`, not `Skeleton`. The shell uses only `Avatar`,
`Dropdown*` and `ThemeToggle`; the pages use none at all.

**Supabase tables** — `profiles`, `students`, `absensis`; storage bucket `uploads` (photo
purge on delete). RLS policies in `supabase/schema.sql` back the guards:
"Admins can view/insert/update/delete profiles", "Admins can delete absensis",
"Admins can insert/update/delete students", `public.is_admin()` helper,
`on_auth_user_created` trigger auto-inserting a profile.

**Route Handlers consumed**: `/api/auth/logout` (shell), `/api/admin/teachers`,
`/api/admin/teachers/[id]`, `/api/admin/teachers/[id]/make-admin`,
`/api/admin/teachers/[id]/remove-admin`, `/api/admin/teachers/[id]/mapel`,
`/api/admin/absensi`, `/api/admin/absensi/[id]`,
`/api/admin/absensi/delete-all`, `/api/admin/absensi/delete-by-period`,
`/api/import-students`, `/api/admin/import-teachers`.
Note `/api/import-students` checks only `getUser()` (no `is_admin`) — admin-only via
`middleware.ts`'s `/admin/import` rule, the layout's guard, and the page guard.

**Libraries**: `sweetalert2` (dashboard-client only), `xlsx` via dynamic
`await import('xlsx')` in both import forms and both import routes, `lucide-react`
(`Inbox`, `X`) in `ts-manager-client.tsx`, plus `lucide-react` throughout the new
shell. No `flatpickr` — `absensi-client.tsx` uses a native `<input type="date">`.

**CSS surface this module needs from `globals.css`**
- The `[data-ds-shell]` shell base (the attribute `src/components/admin/shell.tsx`
  sets on its root) plus the `--ds-*` tokens and the `@theme inline` bridge.
- Everything the brutalist/Bootstrap-parity layer used to supply
  (`.card-brutalist*`, `.btn-brutalist*`, `.table-brutalist`, `.modal-brutalist*`,
  FontAwesome, Bootstrap CDN) was **deleted in the DS v2 migration**, along with
  the temporary legacy-token bridge that used to sit under `.admin-shell`. Icons
  are `lucide-react`; the root layout loads no icon or component-library CDN.

**Shared components**
- `@/components/toast-provider` — `ToastProvider` is mounted in `src/app/layout.tsx`, so
  it *is* in scope for this subtree, but **no file in `src/app/admin/` calls
  `useToast()`**. Feedback is instead inline `card-brutalist` alert banners with
  `border-success` / `border-danger` (or a `borderLeft: 4px solid …` variant) plus native
  `window.confirm()` for destructive actions.
- `@/components/ui/skeleton.tsx` (`Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonTable`)
  and `@/components/ui/empty-state.tsx` (`EmptyState`) are **still not imported anywhere**.
  The design system landing did **not** resolve this: the hand-rolled equivalent is
  unchanged, with a `.empty-state` div in `ts-manager-client.tsx:270`,
  `absensi-client.tsx:494`, `teachers/teacher-table.tsx:152`, `user-table.tsx:153`,
  `explorer/page.tsx:139` and `schedule/page.tsx:142` (6 sites, all still present), and
  `absensi-client.tsx` still renders a `Memuat data...` text block instead of
  `SkeletonTable`.
- `ui/button.tsx` is the most obvious near-miss: the admin pages hand-roll
  `.btn-brutalist` and `ui/input.tsx` (`Input`/`Field`/`Select`) could replace
  `.brutalist-input`/`.brutalist-select` + the hand-built label/hint/error markup in
  both import forms.

**Cross-module navigation** — out-links from `page.tsx`: `/admin/import`,
`/admin/import-teachers`, `/admin/tsmanager`, `/admin/absensi`, `/schedule`, `/export`,
`/explorer`; back-link `← Kembali → /admin` in every sub-page (now redundant with the
sidebar); `dashboard-client.tsx` links to `/export?period=${currentKey}`.
`ts-manager-client.tsx` links to `/admin/import-teachers`. `AdminShell` adds
`/admin`, `/profile` and `/login` and covers all six admin routes. The teacher
shell is **not** rendered here at all: `src/app/admin/layout.tsx:43` mounts
`AdminShell` directly, and `teacher-shell.tsx` / `app-shell.tsx` only reach the
`(dashboard)` routes. The old `@/components/navbar.tsx` (and `mobile-nav.tsx`)
were deleted.

**Deviations from `docs/brutalist-design-spec.md`** — that document is
**historical**: it describes the pre-DS-v2 brutalist / Bootstrap-parity system
and is no longer the active style contract. It is retained here only to record
where the implementation drifted from it.
- §2/§4.2: spec says admin pages live under `/(dashboard)` and inherit navbar +
  mobile nav. `src/app/admin/` still sits outside that group, but now has its own
  `layout.tsx` + `AdminShell`, so admin has a shell — just not the one the spec
  describes. `TeacherShell` / `AppShell` are deliberately absent on `/admin/*`.
- §2: the spec's shell has since been generalised. The `(dashboard)` group now
  wraps `absensi`, `explorer`, `export`, `journal`, `prevSmes`, `profile` and
  `schedule` as well as `/`, so those routes do get `TeacherShell` / `AppShell`
  chrome. `/login`, `/success`, `/error` and `/unauthorized` remain
  deliberately chrome-free, which the spec also asks for.
- §4.2: spec says stats cards use `.stats-card` + `.bg-*-light`; implementation uses
  `.card-brutalist` with inline `style` for the 56×56 icon tiles.
- §4.10: spec lists TS Manager columns "No, Nama, Email, Mapel, Actions" with a sticky
  first column; implementation renders "Nama, Email, No. WhatsApp, Role, Aksi" with no
  `No` column, no sticky column, and `Mapel` moved into a modal button; it uses
  `.badge-admin` / `.badge-guru` instead of `.badge-brutalist`.
- §4.5: spec describes `.stats-card` summaries + per-teacher `.card-brutalist` with
  `.status-bar` dots; implementation uses a CSS-grid 31-day heatmap of `.bg-*-light`
  cells plus a `.table-brutalist` detail table.
- Undefined-in-`globals.css` classes used here: `.min-vh-100` (9 uses),
  `.table-responsive-wrapper` (3), `.popup-list` (5), `.popup-item` (7),
  `.popup-detail` (4), `.popup-item-warning` (3).
