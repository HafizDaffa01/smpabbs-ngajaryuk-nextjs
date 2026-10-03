# src/utils/

The Supabase access layer. One folder, `supabase/`, with three files that each
expose a factory named `createClient` (plus a `createServiceClient` escape
hatch) so that call sites read identically regardless of which runtime they are
in:

| File | Lines | Export | Runtime | Key | Cookie adapter |
|---|---|---|---|---|---|
| `supabase/client.ts` | 10 | `createClient()` | Browser | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `@supabase/ssr` internal |
| `supabase/server.ts` | 36 | `createClient(cookieStore)`, `createServiceClient()` | Server (RSC / Route Handler) | publishable / `SUPABASE_SERVICE_ROLE_KEY` | `cookies()` + `parseCookieHeader`, `setAll` **no-op** |
| `supabase/middleware.ts` | 33 | `createClient(request)` | Edge / Route Handler | publishable | `request.cookies`, `setAll` writes to a fresh `NextResponse` |

All three read the same three env vars, hardcoded at module scope with `!`
non-null assertions (no runtime validation, no `zod` env schema):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY        (server.ts only)
```

`.env*` is gitignored (`.gitignore:33-34`) and there is no `.env.example` in the
repo.

## Responsibility

- Give every server component / Route Handler a **user-scoped, RLS-honouring**
  Supabase client built from the request cookies, so `auth.uid()` matches the
  signed-in teacher and every query is subject to the policies in
  `supabase/schema.sql`.
- Give client components a browser client for `auth.getUser()` and profile reads.
- Give Route Handlers that must refresh the session a client that can **write**
  cookies back onto the response (the `setAll` → `response.cookies.set` +
  `response.headers.set` pair), and return that response alongside the client.
- Provide exactly one service-role (RLS-bypassing) client for the schedule
  mutation endpoints.

## Design

**Factory, not Singleton — the naming hides it.** All three modules export a
`const createClient = (…) => createXClient(…)`. Two of the three happen to
behave like singletons because of what the underlying library does:

- `client.ts:6-10` calls `createBrowserClient(url, key)` with **no options
  object**. `@supabase/ssr` caches the instance behind an `isBrowser()` check
  (verified in `node_modules/@supabase/ssr/dist/main/createBrowserClient.js`),
  so every `createClient()` in a browser bundle returns the same underlying
  client. It has **no callers left** — `navbar.tsx` and `mobile-nav.tsx` were
  deleted and the shell chrome now reads the profile server-side
  (`teacher-shell.tsx` uses `@/utils/supabase/server`). The "singleton" is an
  accident of the library, not an explicit memo.
- `server.ts:8-22` and `middleware.ts:7-33` are **per-request/per-invocation
  factories**. `server.ts` takes the `Awaited<ReturnType<typeof cookies>>` cookie
  store as a parameter (call sites do `const cookieStore = await cookies();
  createClient(cookieStore)`) and hands `getAll: () =>
  parseCookieHeader(cookieStore.toString())` to the library. **Its `setAll()` is
  an empty function body** (lines 17-18) — a server component therefore *cannot*
  refresh the session, which is why session refresh is delegated to
  `middleware.ts` / the root middleware.
- `middleware.ts` is the only variant that can write. It creates
  `let response = NextResponse.next({ request: { headers: request.headers } })`
  *before* the Supabase client, closes over `response` in `setAll`, and returns
  the pair `{ supabase, response }` (line 32) so the handler must remember to
  return `response` (or copy `response.cookies.getAll()` onto its own reply).

**`createServiceClient()` (server.ts:24-36) is deliberately stateless.** It is
`createServerClient` with the `SUPABASE_SERVICE_ROLE_KEY` and a cookie adapter
that only implements `getAll() { return [] }` — no `setAll`, so the library never
tries to persist a session. Because the key bypasses RLS, anything built on it is
"whatever the caller asserts the user id to be".

**Duplicated, not shared — the concrete gotcha.** The root `middleware.ts`
(lines 1-29) does **not** import `createClient` from `src/utils/supabase/middleware.ts`.
It imports `createServerClient, parseCookieHeader` straight from `@supabase/ssr`
and inlines a block that is byte-for-byte the same adapter as
`src/utils/supabase/middleware.ts:12-30`. The consequence: the same code exists
in two places (plus a third variant in `server.ts` with the no-op `setAll`),
and there is a fourth pattern again in
`src/app/api/auth/logout/route.ts`, which copies
`response.cookies.getAll()` onto a `NextResponse.redirect(...)`. Changing the
cookie policy means editing all of them.

**Runtime boundary.** `export const runtime = "edge"` appears in the **root
`middleware.ts` (line 4) only** — neither `src/utils/supabase/middleware.ts` nor
`server.ts` declares a runtime, so they inherit the Node.js default and may use
`next/headers`.

## Data Flow

```
┌──────────────────────────────────────────┐
 browser               │ src/utils/supabase/client.ts            │
 (no callers left)     │ createClient() → cached browser client  │
                       │   auth.getUser()                        │
                       │   profiles.select('name, is_admin')     │
                       │   ⇒ dead code since navbar.tsx /         │
                       │     mobile-nav.tsx were deleted         │
                       └──────────────────────────────────────────┘

                      ┌──────────────────────────────────────────┐
RSC / Route Handler   │ await cookies()                         │
 60 files              │ createClient(cookieStore)               │
                      │   getAll() → parseCookieHeader(...)      │
                      │   setAll() → {}  (no write)             │
                      │   ⇒ RLS enforced as the signed-in user   │
                      └──────────────────────────────────────────┘

                      ┌──────────────────────────────────────────┐
Edge-ish handlers     │ createClient(request)                    │
api/auth/logout       │   ⇒ { supabase, response }              │
api/auth/session      │   setAll() → response.cookies.set(...)  │
api/schedule (GET)    │       + response.headers.set(...)       │
                      │   handler must return `response`        │
                      └──────────────────────────────────────────┘

                      ┌──────────────────────────────────────────┐
Privileged            │ createServiceClient()                   │
api/schedule/[id]     │   key = SUPABASE_SERVICE_ROLE_KEY       │
(3 call sites)        │   getAll() → []                          │
                      │   ⇒ RLS bypassed, no session state      │
                      └──────────────────────────────────────────┘
```

**Session refresh chain (the reason the no-op exists).**
Request → root `middleware.ts` builds its own inline client →
`await supabase.auth.getClaims()` (line 31) lets `@supabase/ssr` verify/refresh
the JWT and, if it changed, `setAll` writes the rotated cookies onto the
`NextResponse` that is returned at line 106 → downstream RSC/handler reads the
already-fresh cookie store. Pages therefore never need write access.

**Auth/authorization on top of the client, in three separate layers.**
1. Root `middleware.ts:37-88` — `protectedRoutes` (`/admin`, `/absensi`,
   `/journal`, `/prevSmes`, `/profile`, `/backup`, `/explorer`, `/export`) require
   `auth.getUser()`; `adminRoutes` (`/admin`, `/backup`, `/explorer`, `/export`,
   `/admin/import`, `/admin/import-teachers`) additionally require
   `profiles.is_admin`; `/login` bounces an already-authenticated user to `/`.
2. Page-level `is_admin` re-checks in `src/app/admin/**`, `/export`, `/explorer`,
   `/backup` (each page does its own `profiles.select('is_admin').single()`).
3. RLS policies in `supabase/schema.sql` are the actual backstop.

Because `setAll` is a no-op on the server client, a token that expires between the
middleware pass and the RSC query is *not* refreshed mid-render; those reads fall
back to whatever RLS sees (usually "no user" / empty result), which is the
classic cause of a mysteriously empty server-rendered table.

## Integration Points

**Consumers (grep-verified).**

| Import | Consumer count | Where |
|---|---|---|
| `@/utils/supabase/server` → `createClient` | **60** files | 21 `page.tsx` + 37 `route.ts`/`route.tsx` + `src/app/admin/layout.tsx` + `src/components/teacher-shell.tsx` |
| `@/utils/supabase/server` → `createServiceClient` | 1 file | `src/app/api/schedule/[id]/route.ts` (3 call sites, lines 10/55/113) |
| `@/utils/supabase/client` → `createClient` | **0** | was `src/components/navbar.tsx:6` and `src/components/mobile-nav.tsx:6`; both components were deleted, so `client.ts` is now unreferenced |
| `@/utils/supabase/middleware` → `createClient` | 3 files | `src/app/api/auth/logout/route.ts:1`, `src/app/api/auth/session/route.ts:2`, `src/app/api/schedule/route.ts:1` |
| `src/utils/supabase/middleware.ts` (module) | 0 | **the root `middleware.ts` re-implements it inline** |

Breakdown of the 21 server-client pages: `(dashboard)/page.tsx`, `absensi/`,
`admin/`, `admin/absensi/`, `admin/import/`, `admin/import-teachers/`,
`admin/teachers/`, `admin/tsmanager/`, `error/`, `explorer/`, `export/`,
`journal/`, `journal/show/`, `login/`, `prevSmes/`, `prevSmes/presensi/`,
`prevSmes/show/`, `profile/`, `schedule/import/`, `success/`,
`unauthorized/`. (21 `page.tsx`; note `src/app/export/backup-client.tsx` and the
other client islands reach Supabase through `fetch('/api/...')` instead.)

**Upstream dependencies.** Only `@supabase/ssr` (`createBrowserClient`,
`createServerClient`, `parseCookieHeader`) and, in `server.ts` only,
`next/headers`' `cookies`. No `serviceRole`-aware helper, no typed `Database`
generic is passed to `createServerClient` — every query in the app is therefore
**untyped** (`data` is `any`), which is why each route declares its own local
row interface (see `src/types/codemap.md`).

**Downstream tables touched.** `profiles` (auth + `is_admin` + `name` + `mapel`),
`students`, `absensis`, `schedules`, `notes`, and the `uploads` Storage bucket —
via `src/app/api/**` and the page components, not from this folder.

**Known discrepancies / risks.**

- **Inlined duplication in root `middleware.ts:11-29`.** Identical to
  `src/utils/supabase/middleware.ts:12-30`; a fix to one will not apply to the
  other, and a reviewer reading `src/utils/` will believe the middleware is
  covered when it is not.
- **`server.ts` `setAll()` is a silent no-op.** No comment explains it; the
  reason is structural (RSC cannot mutate the response) but the cost — tokens
  never refreshing during a server render — is undocumented at the call site.
- **`createServiceClient()` has no authz wrapper.** `api/schedule/[id]/route.ts`
  must verify the caller itself before using it (see that route's
  `profiles.is_admin` check); the helper offers no protection.
- **Non-null assertions on env vars** (`supabaseUrl!`, `supabaseKey!`,
  `supabaseServiceRoleKey!`) mean a missing `.env.local` produces a
  `createServerClient(undefined, undefined)` failure at first call rather than a
  clear build-time error.
- **Env var name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not
  `..._ANON_KEY`** — the legacy `anon` naming that the rest of the Supabase
  ecosystem uses. Worth knowing before copy-pasting official snippets.
- `client.ts` exports no way to reset the cached browser instance, so tests or
  multi-tenant switching cannot get a fresh client in the same page session.
