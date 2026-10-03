# Repository Atlas: NgajarYuk Next

## Project Responsibility

A **school teaching & attendance management system for SMP ABBS Surakarta** (Indonesian public middle school). It is a TypeScript/Next.js rewrite of a legacy **Laravel** application (`jurnal-kelas`); many schema comments and the `src/types/index.ts` header still reference the Laravel original.

Covers four domains:
1. **Teacher attendance** (`absensi`) — GPS + accuracy + photo check-in, graded `S`/`I`/`A` for payroll.
2. **Student daily attendance** (`attendances`) — day/month/year grid keyed to a class roster.
3. **KBM journal** (`notes`) — per-lesson teaching notes against a class schedule, with a date/time "bell" model.
4. **Master data** — teachers (subject assignments via `profiles.mapel` JSONB), students, schedules, spreadsheet import/export/backup.

Design language: **brutalist**, specified in [`docs/brutalist-design-spec.md`](docs/brutalist-design-spec.md). UI language: **Indonesian**.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js **16.3.1**, App Router, RSC + client islands |
| UI | React **19.2.8**, TypeScript 5, Tailwind CSS **4** (`@tailwindcss/postcss`) |
| Data | Supabase — Postgres, Auth (cookie sessions), RLS, Storage (bucket `uploads`) |
| Heavy deps | `@react-pdf/renderer`, `xlsx`, `jszip`, `leaflet`, `sweetalert2`, `flatpickr`, `lucide-react` |
| CDN globals | Bootstrap 5.2.3, FontAwesome 6.4, animate.css, Feather Icons, Leaflet, SweetAlert2, flatpickr (+ `l10n/id`) |
| Package mgr | pnpm (workspace-enabled) |
| Runtime | Node/Edge — `middleware.ts` declares `runtime = "edge"` |
| DB schema | [`supabase/schema.sql`](supabase/schema.sql) — single source of truth for tables, RLS policies, `is_admin()`, `handle_new_user()` trigger |
| Tests | **None.** No test files, no test runner configured. |

## System Entry Points

| File | Role |
|------|------|
| [`middleware.ts`](middleware.ts) | Edge middleware. The **only** place route protection is declared. Owns `protectedRoutes` and `adminRoutes`. Inlines its own `createServerClient` instead of importing `utils/supabase/middleware.ts`. |
| [`src/app/layout.tsx`](src/app/layout.tsx) | Root layout. Fonts (Nunito Sans, Geist Mono), `lang="id"`, `ToastProvider`, all CDN `<link>`/`<Script>` tags. |
| [`src/app/(dashboard)/layout.tsx`](src/app/(dashboard)/layout.tsx) | App shell — `Navbar` + `MobileNav` + `Scripts`. Applies to `/` only. |
| [`src/app/(dashboard)/page.tsx`](src/app/(dashboard)/page.tsx) | Dashboard home. |
| [`src/app/api/`](src/app/api/) | ~60 Route Handlers — the complete data-access layer. |
| [`src/utils/supabase/server.ts`](src/utils/supabase/server.ts) | Per-request cookie-scoped Supabase client used by RSCs and handlers. |
| [`src/utils/supabase/client.ts`](src/utils/supabase/client.ts) | Browser Supabase singleton. |
| [`supabase/schema.sql`](supabase/schema.sql) | Tables, indexes, RLS policies, `is_admin()`, signup trigger. |
| [`src/types/index.ts`](src/types/index.ts) | Legacy-derived interfaces. **Currently imported by nothing.** |
| [`package.json`](package.json) | Scripts: `dev`, `build`, `lint`, plus `dev/user:{create,edit,delete,list}` CLI helpers. |
| [`scripts/user/*.ts`](scripts/user/) | `tsx` CLI for out-of-band user provisioning against Supabase Admin API. |
| [`docs/brutalist-design-spec.md`](docs/brutalist-design-spec.md) | Authoritative UI design spec. |

## Architecture at a Glance

```
next dev
  │
  ├─ middleware.ts (edge)  ──────────── route protection + admin gate
  │
  └─ src/app/(dashboard)/page.tsx  ──── RSC
       │  utils/supabase/server createClient()   [cookie-scoped → RLS applies]
       ▼
     *-client.tsx island  ──── fetch('/api/...') ────► Route Handler
                                                            │ ad-hoc auth + is_admin
                                                            ▼
                                              Supabase Postgres / Storage
```

- **No ORM, no service layer, no repository pattern.** Route Handlers are hand-written controllers calling `supabase.from(...)` directly.
- **No shared type layer.** `src/types/` is orphaned; ~10 files redeclare local row shapes.
- **Auth is enforced twice, inconsistently** — declaratively in `middleware.ts` for pages, imperatively (copy-pasted) in each handler. `/api` is absent from the middleware route lists.
- **Mixed styling systems** — Tailwind utilities layered on hand-written brutalist CSS, with Bootstrap/FontAwesome/animate.css injected globally from CDN.

## Data Model (from `supabase/schema.sql`)

| Table | Grain | Notes |
|-------|-------|-------|
| `profiles` | 1 per auth user | Extends `auth.users`. `is_admin` bool, `mapel` JSONB subject assignment. Auto-created by `handle_new_user()` trigger. **No `email` column** (UI reads it anyway). |
| `students` | roster row | `name`, `progul`, `grade`. Unique on `(name, grade)`. |
| `absensis` | teacher check-in | `user_id`, `nama`, `unit`, `lokasi`, `alamat`, `foto`, `akurasi`, `waktu`, `value 'S'\|'I'\|'A'`. **No `year`/`month` columns** although queries filter on both. |
| `attendances` | student × day | `student_id`, `day`, `month`, `year`, `value 'S'\|'I'\|'A'`. Unique on `(student_id, day, month, year)`. |
| `notes` | lesson note | `class`, `subject`, `teacher_id`, `date`, `time`, `note`, `checked`. **No unique constraint** despite `onConflict` upserts. |
| `schedules` | class × day × period | `subject` (normalized code) + `subject_display`. **No unique constraint** despite `onConflict` upserts. |

RLS: all tables `ENABLE ROW LEVEL SECURITY`. Authenticated users read everything; writes are admin-gated via `public.is_admin()` (defined in SQL, **never called from TypeScript** — handlers inline the same `EXISTS` subquery instead).

## Directory Map (Aggregated)

| Directory | Responsibility Summary | Detailed Map |
|-----------|------------------------|--------------|
| `src/` | App source root; feature-folder layout, `@/*` alias, server/client split convention | [View Map](src/codemap.md) |
| `src/app/` | App Router tree — layouts, RSC pages, Route Handlers, `globals.css` | [View Map](src/app/codemap.md) |
| `src/app/api/` | ~60 Route Handlers. Full endpoint table, auth level per route, Supabase tables touched. Sole enforcement point for `/api` auth | [View Map](src/app/api/codemap.md) |
| `src/app/admin/` | Admin panel. Server-page → `-client.tsx` island pattern; teachers, backup absensi, xlsx imports, TS Manager | [View Map](src/app/admin/codemap.md) |
| `src/app/admin/absensi/` | Attendance backup grid + detail table, inline edit, bulk delete | [View Map](src/app/admin/absensi/codemap.md) |
| `src/app/admin/teachers/` | Teacher CRUD table, add form, edit modal | [View Map](src/app/admin/teachers/codemap.md) |
| `src/app/admin/import/` | Student xlsx import with client-side preview | [View Map](src/app/admin/import/codemap.md) |
| `src/app/admin/import-teachers/` | Teacher xlsx import; Format A/B auto-detection | [View Map](src/app/admin/import-teachers/codemap.md) |
| `src/app/admin/tsmanager/` | Full teacher management incl. `mapel` JSONB modal | [View Map](src/app/admin/tsmanager/codemap.md) |
| `src/app/(dashboard)/` | The only route group; Navbar/MobileNav shell for `/` | [View Map](src/app/(dashboard)/codemap.md) |
| `src/app/absensi/` | Teacher GPS check-in via Leaflet, photo, S/I/A grading | [View Map](src/app/absensi/codemap.md) |
| `src/app/login/` | Sign-in form and redirect handling | [View Map](src/app/login/codemap.md) |
| `src/app/profile/` | Profile edit + password change | [View Map](src/app/profile/codemap.md) |
| `src/app/journal/` | Journal list (archive by class/subject) | [View Map](src/app/journal/codemap.md) |
| `src/app/journal/show/` | KBM lesson-note editor — largest file in repo (639 lines) | [View Map](src/app/journal/show/codemap.md) |
| `src/app/schedule/` | Weekly class schedule grid | [View Map](src/app/schedule/codemap.md) |
| `src/app/schedule/import/` | xlsx schedule import wizard with preview step | [View Map](src/app/schedule/import/codemap.md) |
| `src/app/prevSmes/` | Previous-semester archive hub | [View Map](src/app/prevSmes/codemap.md) |
| `src/app/prevSmes/presensi/` | Archived attendance view | [View Map](src/app/prevSmes/presensi/codemap.md) |
| `src/app/prevSmes/show/` | Archived KBM note view | [View Map](src/app/prevSmes/show/codemap.md) |
| `src/app/export/` | Export centre: CSV/ZIP/PDF generation, backups, bulk delete | [View Map](src/app/export/codemap.md) |
| `src/app/explorer/` | Supabase Storage file browser (bucket `uploads`) | [View Map](src/app/explorer/codemap.md) |
| `src/app/error/` | Covers `error/`, `success/`, `unauthorized/` terminal screens | [View Map](src/app/error/codemap.md) |
| `src/lib/` | Pure domain logic: V94 parser, bell schedule, period system, subject normalizer, `cn` | [View Map](src/lib/codemap.md) |
| `src/components/` | Navbar/MobileNav, S-I-A attendance grid, KBM editor, toast context | [View Map](src/components/codemap.md) |
| `src/components/pdf/` | `@react-pdf/renderer` recap documents (rekap presensi + KBM) | [View Map](src/components/pdf/codemap.md) |
| `src/components/ui/` | Hand-rolled `skeleton` + `empty-state` — **no importers** | [View Map](src/components/ui/codemap.md) |
| `src/utils/` | Supabase client factories (browser / server / service-role) + edge middleware helper | [View Map](src/utils/codemap.md) |
| `src/types/` | Legacy-Laravel interfaces — **zero importers**, diverges from SQL | [View Map](src/types/codemap.md) |
| `supabase/` | `schema.sql` — tables, RLS, `is_admin()`, signup trigger | — |
| `scripts/user/` | `tsx` CLI for user provisioning (create/edit/delete/list) | — |
| `docs/` | Brutalist design specification | — |

## Domain Logic (`src/lib/`)

The only place with real algorithms. Worth reading before touching any feature.

- **`v94-parser.ts`** (467 lines) — parses the school's proprietary "V94" Excel/DBF schedule workbook. Strategy-per-sheet-type with the composite key `` `${cls}|${subject}` ``.
- **`bell-schedule.ts`** — table-driven `DAY_SCHEDULE` bell-time model. Period 3 is gender-split (hence no `3` key); Friday remaps 6/7/8 → 7/8/9.
- **`period-system.ts`** — academic year / semester period math.
- **`subject-normalizer.ts`** — subject-code normalisation shared by schedule import and the KBM editor.
- **`utils.ts`** — a 3-line `cn()` helper that is neither `clsx` nor `tailwind-merge`.

## Notable Findings (verified against source)

Behavioural risks worth knowing before you change anything:

1. **`POST /api/import-students` has no admin check** — any authenticated teacher can mass-upsert the roster. RLS is the only backstop.
2. **`absensis` has no `year`/`month` columns**, yet `GET /api/admin/absensi` and `delete-by-period` filter on both → period deletion silently deletes nothing.
3. **`PUT /api/admin/absensi/[id]` is never called** — that route exports only `DELETE`, so the client's update 405s. The `PUT /api/admin/absensi` collection route spreads the raw body into `.update()` (unvalidated mass assignment).
4. **`notes` / `schedules` `onConflict` targets have no unique constraint** in `schema.sql` (plain `CREATE INDEX` only) → those upserts are expected to 500.
5. **`POST /api/absensi` never writes `absensis.value`**, but `export-waktu` reads `record?.value || 'A'` → real GPS check-ins score as *Absent* in payroll.
6. **`/api/schedule/[id]`** builds a service-role client with an empty cookie adapter, then calls `auth.getUser()` → always 401 (and would bypass RLS if it worked).
7. **`auth.admin.*` is called on the publishable key** in ~10 places; a `createServiceClient()` factory exists but is used only by the broken route above.
8. **`/api/schedule/import` is destructive** — resets teacher passwords to a hardcoded literal and prunes non-admin profiles absent from the upload.
9. **Explorer is doubly broken** — the page posts HTML forms whose verbs don't match the route handlers (405), *and* the handlers read `request.json()` while the UI sends `?path=` in the query string. Folder detection is also inverted relative to `storage-js`'s `FileObject` contract.
10. **`(dashboard)/layout.tsx` only wraps `/`** — `/absensi`, `/journal`, `/profile`, `/schedule`, `/prevSmes` render with no navigation.
11. **Roughly half of `src/app/api/` has no caller** — both PDF routes, all 5 explorer routes, all 6 student routes, `schedule/[id]`, `auth/session`.
12. **No error boundaries** anywhere in `src/`, and **no tests**.
13. `src/types/index.ts`, `src/components/ui/*`, `src/components/pdf/*` are effectively orphaned; several CSS classes (`.min-vh-100`, `.table-responsive-wrapper`, `.popup-*`) are used but never defined.

## Working Conventions

- `@/components`, `@/lib`, `@/utils`, `@/types` — always use the alias, never `../..`.
- Route Handlers return `NextResponse.json`; errors are ad-hoc `{ error: string }` bodies, no shared envelope.
- Supabase client always comes from `utils/supabase/*` — never construct it inline (the root `middleware.ts` is the one exception, and that duplication is worth fixing).
- Interactive UI lives in a `'use client'` file; if the page is a Server Component, the island is `*-client.tsx`.
- Follow [`docs/brutalist-design-spec.md`](docs/brutalist-design-spec.md) for any new UI. Note that existing pages **deviate** from it (`.card-brutalist` vs `.stats-card`, heatmap grid vs `.status-bar` dots, different TS Manager columns) — match the surrounding file over the spec.
- `pnpm dev` for local work; `pnpm lint` for lint. `pnpm dev/user:*` for CLI user management.
- Environment: `.env.local` (Supabase URL + publishable key). A service-role secret would be needed to fix findings 6–7.
