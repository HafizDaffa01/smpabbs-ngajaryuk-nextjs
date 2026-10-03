# src/app/login/

## Responsibility

Unauthenticated entry point. Handles Supabase password authentication (email + password) and performs the login→redirect dance with middleware. The route is split into a **server page** (checks for existing session) and a **client form** (POSTs to an API route and navigates on success).

| File | Kind | Lines | Exports |
|---|---|---|---|
| `page.tsx` | Async Server Component | 63 | `metadata`, default `LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> })` |
| `login-form.tsx` | Client Component (`'use client'`) | 115 | default `LoginForm({ message }: { message: string | null })` |

## Design

### `page.tsx` — server guard

- Metadata: `title: 'Login - NgajarYuk'`, `description: 'Login ke sistem NgajarYuk'`.
- Reads cookies via `cookies()` → `createClient(cookieStore)`.
- `auth.getUser()` immediately: **if already authenticated (`user` exists) → `redirect('/')`**. This is the reverse of the `middleware.ts` public-route branch (`if (user) return NextResponse.redirect(new URL('/', request.url))` for `/login`); the edge middleware and this server check can both fire depending on the request path.
- Awaits `searchParams` (Next.js 15+ async params), extracts `message` (or `null`). The form displays that message as a success banner.
- Layout: full viewport, dark background (`bg-dark-900`), centers the card. The card is `.card-brutalist` (max-width 28rem). Header shows a 56×56px square logo with `linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)`, hard `boxShadow: '3px 3px 0px rgba(0,0,0,0.4)'`, `borderRadius: '2px'`, an inline FontAwesome `<i class="fas fa-book-open text-white" style={{ fontSize: '1.5rem' }}></i>`, the app name `"NgajarYuk"` (900 weight, letter-spacing -0.02em), and subtitle `"Masuk untuk melanjutkan"`. The form is passed through `<LoginForm message={message} />`.

### `login-form.tsx` — client form

- Local state: `loading` (bool), `error` (string|null).
- `useRouter()` for post-success navigation.
- `handleSubmit(event: React.FormEvent<HTMLFormElement>)`: prevents default, sets `loading=true`, `error=null`, `new FormData(event.currentTarget)`. Calls `fetch('/api/auth/login', { method: 'POST', body: formData, credentials: 'include' })`.
- Parses `const data = await response.json()` and treats `!response.ok` as failure with `data.error || 'Login gagal'`. On success: `router.push('/')` (client-side). On error: `setError(err.message)`. Finally: `setLoading(false)`.
- Alerts:
  - `message` (prop, typically from a redirect param like `/login?message=...`) renders as a green success box (`background: 'var(--success-soft)'`, `border: '2px solid rgba(16, 185, 129, 0.3)'`), `role="alert"`.
  - `error` renders as a red box (`var(--danger-soft)`, red border), `role="alert"`.
- Fields: `email` (type email, required, placeholder `nama@contoh.com`, `.brutalist-input`), `password` (type password, required, placeholder `••••••••`, `.brutalist-input`). Labels are `.section-label` with `fontSize: '0.65rem'`.
- Submit: `.btn-brutalist` full width (`w-100 mt-1`), disabled while `loading`, text swaps to `'Memproses...'` / `'Login'`.

## Data Flow

### Client → API

`POST /api/auth/login` with `FormData` body containing `email` and `password`. The client explicitly sets `credentials: 'include'` so Supabase auth cookies set by the server response are stored in the browser.

### `src/app/api/auth/login/route.ts` (POST)

- Reads `formData.get('email')` and `formData.get('password')` (strings). Missing → **400** `{ error: 'Email dan password harus diisi' }`.
- Uses `cookies()` to get the request cookie store (for writing Set-Cookie), but constructs a server Supabase client via `@supabase/ssr`'s `createServerClient` with a **hybrid cookie adapter**:
  ```ts
  cookies: {
    getAll() { return parseCookieHeader(request.cookies.toString()) },
    setAll(cookiesToSet) { cookiesToSet.forEach(({name, value, options}) => { cookieStore.set(name, value, options) }) }
  }
  ```
  This reads cookies from the raw request header and writes refreshed auth cookies back into the Next.js `cookieStore` (which will be attached to the `NextResponse.json`).
- Calls `supabase.auth.signInWithPassword({ email, password })`.
- Failure → **401** `{ error: 'Email atau password salah' }` (generic message to avoid user enumeration).
- Success → **200** `{ success: true }`. (No redirect from the API; the client performs `router.push('/')`.)
- Catch-all → **500** `{ error: 'Terjadi kesalahan server' }`.
- `GET()` returns **405** `{ error: 'Method not allowed' }`.

### Supabase auth provider

`signInWithPassword` uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with server-side cookies; Supabase's auth sets `sb-*-auth-token` cookies via `setAll`. The client-side form then navigates to `/` and middleware will see the session on subsequent requests.

### Logout/session helpers (for context)

- `POST /api/auth/logout` (`src/app/api/auth/logout/route.ts`): calls `supabase.auth.signOut()` via middleware's `createClient(request)` (which returns `{ supabase, response }`), copies all cookies from `response.cookies` to a fresh `NextResponse.redirect('/login', 302)` and returns it. (`GET()` → 405.)
- `GET /api/auth/session` (`src/app/api/auth/session/route.ts`): `createClient(request)` → `auth.getUser()` → 401 `{ authenticated: false }` or 200 `{ authenticated: true, user: { id, email, name: profile?.name, is_admin: profile?.is_admin ?? false } }`.

## Integration Points

- **Auth middleware:** `middleware.ts` treats `/login` as a `publicRoutes` entry; when a session exists it `return NextResponse.redirect(new URL('/', request.url))`. That edge redirect is the first line of defence, while `login/page.tsx` does the same on the server for full HTML responses.
- **Supabase SSR:** `@supabase/ssr` `createServerClient`, cookie parsing via `parseCookieHeader`. Client uses browser client (`src/utils/supabase/client.ts`) elsewhere.
- **Globals:** uses `.card-brutalist`, `.btn-brutalist`, `.brutalist-input`, `.section-label` from `globals.css` (brutalist theme).
- **Root layout:** ToastProvider wraps the app but this page doesn't call `useToast()`; it uses inline `role="alert"` blocks. CDN scripts (sweetalert2, etc.) load globally.
- **Redirect target:** `router.push('/')` lands on `/(dashboard)/page.tsx`. The `searchParams.message` prop is one-way (passed down from server) — it's not set by the API, only by server-side redirects that render `/login?message=...`.

## Notes

- The email field is a standard HTML `type="email"` (client validation) but the server only checks for truthiness; no format validation beyond that. Password has no client-side complexity rules here (complexity is enforced on profile/password change in `/api/profile/password/route.ts`: min 8, must include uppercase, lowercase, number).
- No "forgot password" or "sign up" links are present in this form.
- `credentials: 'include'` is necessary so the Set-Cookie headers from the API response are persisted by the browser before `router.push('/')`.
- The server page's `auth.getUser()` uses the same cookie store and will redirect logged-in users away from `/login` even if middleware somehow missed it.