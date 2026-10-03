# src/app/error/ (covers `error/`, `success/`, `unauthorized/`)

## Responsibility

Three tiny terminal-state routes that all render the same thing: a single centred brutalist card with an icon, a title, a message and one "back to dashboard" button. They are **explicit navigation targets, not error boundaries**.

| Directory | File | Icon | Accent | Title | Message source |
|---|---|---|---|---|---|
| `src/app/error/` | `page.tsx` (63 lines) | lucide `X` | `--danger-soft` bg / `2px solid var(--danger)` | `Terjadi Kesalahan` | `?message=` or `'Terjadi kesalahan saat memproses permintaan Anda.'` |
| `src/app/success/` | `page.tsx` (63 lines) | lucide `Check` | `--success-soft` bg / `2px solid var(--success)` | `Berhasil` | `?message=` or `'Operasi berhasil dilakukan.'` |
| `src/app/unauthorized/` | `page.tsx` (56 lines) | lucide `ShieldAlert` | `--warning-soft` bg / `2px solid var(--warning)` | `Akses Ditolak` | hard-coded `'Anda tidak memiliki hak akses ke halaman ini.'` |

(`src/app/success/` and `src/app/unauthorized/` each also carry their own placeholder `codemap.md`; this file is the single map for all three routes.)

## Design

The three files are structural clones. `error/page.tsx` in full:

```tsx
export const metadata = { title: 'Error - NgajarYuk', description: 'Terjadi kesalahan' }

export default async function ErrorPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const cookieStore = await cookies()
  const supabase   = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params  = await searchParams
  const message = params?.message ?? 'Terjadi kesalahan saat memproses permintaan Anda.'
  …
}
```

Shared structure:

- **Server components** (no `'use client'`), all `async`, all typed with the Next 15+ `searchParams: Promise<{...}>` convention and awaited.
- **Auth gate:** `cookies()` → `createClient(cookieStore)` from `@/utils/supabase/server` → `auth.getUser()` → `redirect('/login')`. So these pages require a session even though they are informational; an anonymous visitor to `/error?message=...` is sent to `/login` instead.
- **Container:** `d-flex flex-column align-items-center justify-content-center min-vh-100 px-4 bg-dark-900`.
- **Card:** `.card-brutalist.text-center` with inline `style={{ maxWidth: '28rem', width: '100%' }}` (matching design spec §4.1/§4.9's 448px cap).
- **Header:** a 64×64px icon wrapper with `borderRadius: '2px'`, `boxShadow: '3px 3px 0px rgba(0, 0, 0, 0.4)'`, the page's `--*-soft` background and `border: '2px solid var(--<accent>)'`; the lucide icon at `width: 32, height: 32` and `color: var(--<accent>)`. Then an `<h1>` at `fontSize: '1.5rem', fontWeight: 900` in `text-danger` / `text-success` / `text-warning`, and a `<p class="text-muted mb-0">` carrying the message.
- **Body:** exactly one `<Link href="/" className="btn-brutalist">Kembali ke Dashboard</Link>`.

`unauthorized/page.tsx` differs only in taking **no** `searchParams` at all (its copy is a constant) and in using the warning accent rather than danger.

### Error-boundary situation (verified)

A filesystem sweep of `src/` finds **no** `error.tsx`, **no** `global-error.tsx`, **no** `not-found.tsx`, **no** `reset.ts`, and **no** `loading.tsx` anywhere in the app directory. Consequences:

- **Unhandled exceptions** in any server or client component fall through to the framework's built-in error screen. There is no branded fallback and no `reset()` affordance; the brutalist styling contract in `docs/brutalist-design-spec.md` does not cover crash states at all.
- **Unmatched URLs** render the framework's default 404, not a styled page.
- **The `/error` and `/success` routes are unreachable from within the app.** Grepping every `.ts`/`.tsx` in `src/` for `/error` and `/success` finds **no** `redirect()` call, no `Link`, and no `fetch` to either path — only their own `codemap.md` placeholders. They can currently only be reached by manually typing the URL with an optional `?message=` query param. In practice this app reports failures with the inline `role="alert"` banners used by `src/app/journal/show/journal-form.tsx`, `src/app/schedule/import-form.tsx`, `src/app/absensi/absensi-form.tsx`, and `useToast()` toasts in `src/components/toast-provider.tsx` — never with these pages.

## Data Flow

```
Browser ──GET /error?message=<text>────────►  ErrorPage      → redirect('/login') if no session
Browser ──GET /success?message=<text>──────►  SuccessPage    → redirect('/login') if no session
Browser ──GET /unauthorized────────────────►  UnauthorizedPage → redirect('/login') if no session
```

- Each page runs exactly **one** Supabase call (`auth.getUser()`) and **no** table reads, writes, or API routes. The message is passed purely through the query string.
- There is no server action, no redirect *into* these routes from any API handler, and no logging side-effect.

### Who actually sends users to `/unauthorized`

`/unauthorized` is the only one of the three with real inbound traffic — **11 page-level `redirect('/unauthorized')` calls plus the middleware**:

| Source | Guard |
|---|---|
| `middleware.ts` (lines 64–87) | any path under `adminRoutes` = `/admin`, `/backup`, `/explorer`, `/export`, `/admin/import`, `/admin/import-teachers` when `profiles.is_admin` is falsy |
| `src/app/admin/page.tsx:31` | `profiles.is_admin` |
| `src/app/admin/import/page.tsx:30` | `profiles.is_admin` |
| `src/app/admin/import-teachers/page.tsx:30` | `profiles.is_admin` |
| `src/app/admin/teachers/page.tsx:30` | `profiles.is_admin` |
| `src/app/admin/absensi/page.tsx:30` | `profiles.is_admin` |
| `src/app/admin/tsmanager/page.tsx:30` | `profiles.is_admin` |
| `src/app/explorer/page.tsx:34` | `profiles.is_admin` |
| `src/app/export/page.tsx:51` | `profiles.is_admin` |
| `src/app/schedule/import/page.tsx:30` | `profiles.is_admin` |

So the pattern is uniform: **edge middleware catches the bulk, and every admin page re-checks server-side** as defence-in-depth — the same double-gate pattern used for `/admin` and `/api/schedule/import`.

## Integration Points

- **Auth middleware:** none of `/error`, `/success`, `/unauthorized` appear in `middleware.ts`'s `protectedRoutes` or `publicRoutes`, so they are neither edge-protected nor edge-redirected; the only gate is each page's own `auth.getUser()` + `redirect('/login')`. Because `config.matcher` still matches them, they pass through the middleware's `supabase.auth.getClaims()` call (which refreshes cookies on the response) before the page renders.
  - **Layout:** all three are siblings of `src/app/(dashboard)/`, so they render under
    the root layout only — no app shell chrome at all (no sidebar, topbar, or
    `Scripts`). That is exactly what `docs/brutalist-design-spec.md` §2 prescribes
    ("Auth pages … use a separate, minimal layout without the dashboard navbar …
    standalone full-viewport centered cards").
- **Supabase:** `@/utils/supabase/server`'s cookie-store client; reads the session only.
- **Design system:** design spec §4.9 ("Error / Success Pages") and §10's colour table (Error → Danger, Success → Success, Auth → Danger) describe precisely what the code does; §4.1's Unauthorized card specs (64×64px icon, `text-danger` title — the code uses `text-warning` for unauthorized) are the only mismatch, which the spec itself resolves with "the same pattern … with appropriate accent colors".
- **CSS classes:** `.card-brutalist`, `.card-brutalist-header`, `.card-brutalist-body`, `.btn-brutalist`, plus the `--danger`/`--success`/`--warning` and `--*-soft` custom properties from `src/app/globals.css`.
- **Icons:** `lucide-react` (`X`, `Check`, `ShieldAlert`). No FontAwesome, no sweetalert2 — unlike `/login`, which uses a FontAwesome `fa-book-open` glyph.
- **Toast system:** not used. `ToastProvider` is mounted globally in `src/app/layout.tsx`, but these pages surface nothing through it.
- **Extension point:** if these pages are ever wired up, the natural contract is `router.push('/error?message=' + encodeURIComponent(text))` from the existing inline-alert sites, plus a `src/app/error.tsx` + `src/app/global-error.tsx` for genuine boundary coverage (neither exists today).