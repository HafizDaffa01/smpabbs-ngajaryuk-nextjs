# src/app/

## Responsibility

The App Router tree. Every HTTP-visible surface of the app is declared here: layouts, RSC pages, Route Handlers, and the single global stylesheet. This folder also owns the `middleware.ts`-adjacent route inventory — the folder tree *is* the application's route table and its authorization contract.

## Design

**Route groups** — `(dashboard)` is the only group, and it now wraps **all** teacher-facing routes: `/` plus `journal`, `absensi`, `schedule`, `prevSmes`, `export`, `explorer` and `profile`. Its `layout.tsx` renders `TeacherShell` (which resolves the signed-in teacher server-side and delegates to `AppShell`) plus `Scripts` (the SweetAlert2 palette hook), and supplies the `%s | NgajarYuk` title template. It deliberately **does not redirect** — an unauthenticated visitor gets the page with no chrome, so each page keeps ownership of its own guard.

**Layouts** — three: `layout.tsx` (root: `next/font/google` fonts, the blocking `localStorage.theme` script, `ToastProvider`, `lang="id"`; it loads no CDN asset and no external stylesheet `<link>`), `(dashboard)/layout.tsx` (teacher chrome), and `admin/layout.tsx` (admin gate + `AdminShell`; `redirect('/login')` or `redirect('/unauthorized')`). `/login` and the three terminal-state routes render under the root layout alone, which is intentional.

**Server/client island pattern** — feature pages are `async` Server Components that do the auth guard + Supabase read, then hand plain serializable props to a `-client.tsx` island holding all interactivity. Smaller pages (`login`, `absensi`, `profile`, `export/page.tsx`, `schedule/import`) skip the split and are single `'use client'` files.

**Route Handlers** — `route.ts` (or `route.tsx` for the two PDF routes). Each exports one or more of `GET/POST/PUT/PATCH/DELETE` returning `NextResponse.json`. There is a shared helper module, so the ~12-line `getUser()` + `profiles.is_admin` preamble is duplicated in roughly 25 handlers. The two `/api/export/pdf/*` routes are `.tsx` because they construct React PDF documents.

**Styling** — Tailwind 4 is CSS-first (no `tailwind.config.*`). `globals.css` (499 lines) defines the `--ds-*` token set (light by default, overridden by a `.dark` block), an `@theme inline` bridge, a `[data-ds-shell]`-scoped shell base, and SweetAlert2 / `.ny-pop-*` rules; the old Bootstrap-parity and "brutalist" CSS layers were **deleted** in the DS v2 migration, so the `.card-brutalist` / `.btn-brutalist` / `.table-brutalist` / `.brutalist-select` / `.section-label` classes named in route codemaps no longer exist. Components build on `components/ui/` primitives and `lucide-react` icons. `docs/brutalist-design-spec.md` is **historical**, not the active contract.

**No route-segment conventions** — zero `loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `template.tsx`, `default.tsx`, or `route.ts` groups. Error handling is entirely page-level: 11 pages call `redirect('/unauthorized')`, and `error/page.tsx`, `success/page.tsx`, `unauthorized/page.tsx` are hand-built terminal screens.

## Flow

1. Request hits `middleware.ts` (edge) → cookie session parsed → `protectedRoutes` / `adminRoutes` checked → redirect to `/login` (with `?redirect=`) or `/unauthorized`.
2. If authorized, the matching `page.tsx` renders. Server Components may call `utils/supabase/server` directly; the request cookie scopes the client so RLS applies.
3. The page renders and, if interactive, hydrates a `*-client.tsx` island.
4. User actions `fetch('/api/...')`. **`/api` is not covered by the middleware matcher lists**, so the handler is the sole auth gate.
5. Handler validates ad hoc, calls Supabase, returns JSON. The island updates local state.

## Integration

**Route inventory by access level** (enforced in `middleware.ts`):

| Access | Routes |
|--------|--------|
| Public | `/login` (redirects to `/` when authed) |
| Authenticated | `/`, `/absensi`, `/journal`, `/journal/show`, `/schedule`, `/schedule/import`, `/prevSmes`, `/prevSmes/*`, `/profile` |
| Admin only | `/admin`, `/admin/teachers`, `/admin/absensi`, `/admin/import`, `/admin/import-teachers`, `/admin/tsmanager`, `/explorer`, `/export`, `/backup` |
| Terminal states | `/error`, `/success`, `/unauthorized` |

**Sub-area maps:**

| Path | Responsibility | Map |
|------|----------------|-----|
| `api/` | ~60 Route Handlers — auth, admin CRUD, exports, explorer, journal, schedule, import | [Map](api/codemap.md) |
| `admin/` | Admin panel screens + TS Manager (`AdminShell` layout gate) | [Map](admin/codemap.md) |
| `(dashboard)/export/` | Export centre UI and backup client | [Map]((dashboard)/export/codemap.md) |
| `(dashboard)/explorer/` | Storage file browser | [Map]((dashboard)/explorer/codemap.md) |
| `(dashboard)/journal/` | Journal list + KBM editor | [Map]((dashboard)/journal/codemap.md) |
| `(dashboard)/schedule/` | Schedule grid + xlsx import wizard | [Map]((dashboard)/schedule/codemap.md) |
| `(dashboard)/prevSmes/` | Previous-semester archive views | [Map]((dashboard)/prevSmes/codemap.md) |
| `(dashboard)/absensi/` | GPS attendance check-in | [Map]((dashboard)/absensi/codemap.md) |
| `(dashboard)/profile/` | Profile edit + password change | [Map]((dashboard)/profile/codemap.md) |
| `(dashboard)/` | Teacher route group: home + `journal`, `absensi`, `schedule`, `prevSmes`, `export`, `explorer`, `profile` | [Map]((dashboard)/codemap.md) |
| `login/` | Sign-in form (root layout only, no chrome) | [Map](login/codemap.md) |
| `error/` | Covers `error/`, `success/`, `unauthorized/` (root layout only) | [Map](error/codemap.md) |

**Cross-cutting concerns:**
- `globals.css` → all pages: `--ds-*` tokens, the `.dark` block + `@custom-variant dark (&:where(.dark, .dark *));`, and the `[data-ds-shell]`-scoped utilities (`.focus-ring`, `.eyebrow`, `.meta`, `.prose-block`, `.action-row`). The old `.admin-shell` selector/class is gone.
- Fonts and icons: `next/font/google` in the root layout, `lucide-react` per component. No icon or component-library CDN.
- Leaflet, flatpickr, SweetAlert2, `xlsx`, `jszip` are npm packages imported directly by the files that use them. `(dashboard)/absensi/absensi-form.tsx:7` carries `import 'leaflet/dist/leaflet.css'` — the Leaflet stylesheet was previously never loaded at all, a real bug.
- Root `middleware.ts` is the only place that knows the protected-route list; it is duplicated knowledge, not shared with `api/`.
