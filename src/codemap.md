# src/

## Responsibility

Application source root for NgajarYuk Next. Holds everything the Next.js compiler bundles: the App Router tree (`app/`), the shared component library (`components/`), the domain/parsing library (`lib/`), the Supabase client factories (`utils/supabase/`), and the (currently orphaned) shared type declarations (`types/`).

This is a **feature-folder, not a layered** layout: there is no `services/`, `models/`, or `repositories/`. Business logic lives in two places only — Route Handlers under `app/api/`, and pure functions under `lib/`. Everything else is presentation.

## Design

**Path alias** — `tsconfig.json` maps `@/*` → `./src/*`. Every import in the repo uses `@/...`; there are no relative parent-escapes (`../../..`) except inside route folders addressing their own siblings.

**Server/client split** — Next.js App Router RSC convention. Server Components are `async` and may call `createClient()` from `utils/supabase/server` directly. Client islands are suffixed `-client.tsx` (`export/backup-client.tsx`, `admin/dashboard-client.tsx`, `admin/absensi/absensi-client.tsx`, `admin/tsmanager/ts-manager-client.tsx`) or carry a top-level `'use client'`. There is no React Context for server data — each page fetches independently.

**Data access** — there is no ORM and no query builder. Route Handlers are hand-written controllers that call `supabase.from(...).select/insert/update/upsert/delete` directly and return `NextResponse.json`. RLS in `supabase/schema.sql` is the last line of defence.

**Auth** — Supabase Auth with cookie sessions. `middleware.ts` (repo root, `runtime = "edge"`) performs route protection using an **inlined** `createServerClient` rather than importing `utils/supabase/middleware.ts` — duplicated, not reused. The `/api` prefix is absent from both `protectedRoutes` and `adminRoutes`, so every handler enforces its own auth (copy-pasted, ~25 times).

**Styling** — **DS v2**. Tailwind 4 (`@tailwindcss/postcss`) is CSS-first: there is no `tailwind.config.*`, and none should be added. `app/globals.css` holds ~196 `--ds-*` token declarations, an `@theme inline` bridge that exposes them as Tailwind utilities, and a `.dark` block. Components compose primitives from `components/ui/` rather than hand-rolling markup. `docs/brutalist-design-spec.md` is **historical** — it documents the pre-DS-v2 brutalist / Bootstrap-parity system and is no longer the style contract.

**Light default, dark opt-in** — `globals.css` declares `@custom-variant dark (&:where(.dark, .dark *));` and a `.dark` token block; `app/layout.tsx` injects a blocking inline script that adds `.dark` to `<html>` when `localStorage.theme === 'dark'`, so there is no flash of the wrong scheme. `src/components/ui/theme-toggle.tsx` owns the toggle.

**Assets** — fonts come from `next/font/google` (Nunito → `--font-nunito-sans`, Geist Mono → `--font-geist-mono`, Amiri → `--font-amiri` for hadith); icons are `lucide-react` components. Leaflet, flatpickr, SweetAlert2, `xlsx` and `jszip` are **npm packages imported directly** by the components that use them. There are **no CDN assets and no external `<link>` tags** — `app/layout.tsx` loads no FontAwesome, Bootstrap, Feather, animate.css, SweetAlert2, Leaflet or flatpickr CDN resource; vendor stylesheets (e.g. `flatpickr/dist/themes/airbnb.css`) are imported from the npm package by the components that need them.

**Class names** — `cn()` in `lib/utils.ts` is `twMerge(clsx(inputs))`, so a caller-supplied Tailwind class reliably overrides a component default.

**Fonts** — `next/font/google`: Nunito Sans (`--font-nunito-sans`), Geist Mono (`--font-geist-mono`), Amiri (`--font-amiri`, `preload: false`, weight 400 only).

## Flow

```
Browser
  │
  ├─ Next.js Middleware (edge)  ── route protection, admin gate, login redirect
  │
  ├─ RSC page  ────────────────► utils/supabase/server createClient()
  │      │                            │ (cookie-scoped, per-request)
  │      └─► renders page UI ───► passes plain props to *-client.tsx island
  │                                     │
  │                                     └─ fetch('/api/...') on user action
  │                                              │
  │                                              ▼
  └──────────────────────────────────── Route Handler (app/api/**/route.ts)
                                                   │ re-checks auth + is_admin
                                                   ▼
                                          Supabase (Postgres + RLS)
                                          Supabase Storage (bucket: uploads)
```

Data never flows server→client automatically after hydration; client islands re-fetch on mount. Write paths are always user-triggered (button/grid cell), never optimistic-except-grid-edits.

## Integration

| Directory | Responsibility | Map |
|-----------|----------------|-----|
| `app/` | App Router tree: RSC pages, Route Handlers, layouts, global CSS | [Map](app/codemap.md) |
| `app/api/` | ~60 Route Handlers — the entire data-access layer | [Map](app/api/codemap.md) |
| `app/admin/` | Admin screens (teachers, absensi, imports, TS Manager) | [Map](app/admin/codemap.md) |
| `app/(dashboard)/` | The only route group; wraps the home page **and** `journal`, `absensi`, `schedule`, `prevSmes`, `export`, `explorer`, `profile` | [Map](app/(dashboard)/codemap.md) |
| `app/(dashboard)/export/` | CSV/ZIP/PDF export + backup UI | [Map](app/(dashboard)/export/codemap.md) |
| `app/(dashboard)/explorer/` | Supabase Storage file browser | [Map](app/(dashboard)/explorer/codemap.md) |
| `app/(dashboard)/journal/` | KBM (lesson-note) journal list + editor | [Map](app/(dashboard)/journal/codemap.md) |
| `app/(dashboard)/schedule/` | Class schedule view + xlsx import | [Map](app/(dashboard)/schedule/codemap.md) |
| `app/(dashboard)/prevSmes/` | Previous-semester read-only archive | [Map](app/(dashboard)/prevSmes/codemap.md) |
| `app/(dashboard)/absensi/` | Teacher GPS attendance check-in | [Map](app/(dashboard)/absensi/codemap.md) |
| `app/(dashboard)/profile/` | Self-service profile | [Map](app/(dashboard)/profile/codemap.md) |
| `app/login/` | Auth entry (outside the group; no chrome) | [Map](app/login/codemap.md) |
| `app/error/`, `success/`, `unauthorized/` | Error/redirect terminal states | [Map](app/error/codemap.md) |
| `lib/` | Pure domain logic: V94 parser, bell schedule, period system, subject normalizer | [Map](lib/codemap.md) |
| `components/` | Shells (`app-shell`, `teacher-shell`, `teacher-nav`), attendance grid, KBM editor, toast provider | [Map](components/codemap.md) |
| `components/pdf/` | `@react-pdf/renderer` recap documents | [Map](components/pdf/codemap.md) |
| `components/ui/` | DS v2 primitives: button, input, card, table, dialog, dropdown, badge, avatar, stat-card, theme-toggle, swal-theme, … | [Map](components/ui/codemap.md) |
| `utils/supabase/` | `createClient` (browser/server) + service-role factory | [Map](utils/codemap.md) |
| `types/` | Legacy-Laravel-derived interfaces — **zero importers** | [Map](types/codemap.md) |

**Known structural gaps** (details in the child maps):
- `src/types/index.ts` is imported by nothing; ~10 files redeclare local row shapes. It also diverges from `supabase/schema.sql` (`Absensi.value` missing, `Profile.mapel` too narrow).
- `components/pdf/*` is referenced only by the two `/api/export/pdf/*` routes, and nothing in the UI links to those routes.
- `components/ui/*` is now adopted widely (198 import sites). `skeleton.tsx` and `empty-state.tsx` remain the least-used primitives — some call sites still hand-roll an `.empty-state` div (see [components/ui/codemap.md](components/ui/codemap.md)).
- There is no `error.tsx`, `global-error.tsx`, `not-found.tsx`, or `loading.tsx` anywhere in `src/`.
- No test files exist in the repository.
