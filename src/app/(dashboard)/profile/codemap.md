# src/app/profile/

## Responsibility

Self-service account management for authenticated users: view/edit profile fields and change the Supabase Auth password. Split into a **server page** (fetches current profile + user email, requires auth) and a **client form** (uses `useToast()` from `ToastProvider` and calls two separate API routes).

| File | Kind | Lines | Exports |
|---|---|---|---|
| `page.tsx` | Async Server Component | 62 | `metadata`, default `ProfilePage` |
| `profile-form.tsx` | Client Component (`'use client'`) | 322 | default `ProfileForm({ profile, email }: ProfileFormProps)` |

## Design

### `page.tsx` — server data loader

- Metadata: `title: 'Profil - NgajarYuk'`, `description: 'Kelola profil dan password'`.
- Auth gate: `cookies()` → `createClient(cookieStore)` → `auth.getUser()` → `redirect('/login')` if `!user`.
- Loads full profile: `profiles.select('*').eq('id', user.id).single()` → `redirect('/login')` if `!profile` (defensive guard).
- Renders `.d-flex flex-column align-items-center justify-content-center min-vh-100 px-4 py-5` with `maxWidth: '42rem'`. Card is `.card-brutalist` with header showing an 80×80px square avatar badge (`borderRadius: '0'`, `border: '2px solid var(--primary)'`, `boxShadow: '3px 3px 0px rgba(0,0,0,0.4)'`, `background: var(--primary-soft)`) and the initial letter: `{profile.name?.charAt(0).toUpperCase() ?? 'U'}` in `style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)' }}`. Body passes `<ProfileForm profile={profile} email={user.email ?? ''} />`.

The `profile` type used by the form is:

```ts
type Profile = {
  id: string
  name: string
  phone_num?: string | null
  is_admin: boolean
}
```

### `profile-form.tsx` — client editor

Two independent forms sharing the same component:

1. **Update Profil** — edits only `phone_num` (name and email are read-only in the UI).
2. **Update Password** — changes Supabase auth password after validating current password and complexity.

**Hooks/state:**
- `const { addToast } = useToast()` from `@/components/toast-provider` (ToastProvider is mounted in root layout). All success/error feedback uses toasts (not inline alerts except password errors).
- `loading` (profile save), `passwordLoading` (password save).
- `router = useRouter()`.
- Profile form fields: `phoneNum = useState(profile.phone_num ?? '')`.
- Password form fields: `currentPassword`, `newPassword`, `confirmPassword`, `passwordErrors` (string[]).

**Profile form (`handleUpdateProfile`):**

1. `preventDefault()`, `setLoading(true)`.
2. `PUT /api/profile` with JSON body `{ phone_num: phoneNum || null }` (Content-Type: application/json).
3. Parses response: on `!response.ok` → `addToast('error', data.error || 'Gagal memperbarui profil')` and returns. On success → `addToast('success', 'Profil berhasil diperbarui!')` then `router.refresh()` to reload server data (so the header initial letter/name stay in sync).
4. Catch → `addToast('error', 'Terjadi kesalahan')`, finally `setLoading(false)`.

UI for this form: `.card-brutalist` header with `.section-label` `UPDATE_PROFIL` and `h5 mb-0 "Update Profil"`. Body is `.d-flex flex-column gap-3`. Three fields use `.custom-input-group` (existing CSS class in `globals.css`):
- **Nama (disabled):** `.custom-input-group.disabled`, icon `<i className="fas fa-user" />`, input value `{profile.name}` disabled, status box `<i className="fas fa-lock text-muted" />`. Hint: `"Nama hanya dapat diubah oleh Admin."`
- **Alamat Email (disabled):** `.custom-input-group.disabled`, envelope icon, disabled input `{email}`, lock icon.
- **Nomor WhatsApp (editable):** `.custom-input-group`, WhatsApp icon (`fab fa-whatsapp text-success`), controlled input `type="tel"`, placeholder `08123456789`, value `phoneNum`, `onChange={(e) => setPhoneNum(e.target.value)}`.
Submit is `.btn-brutalist` disabled when `loading`, text `'Menyimpan...'` / `'Update Profil'`.

**Password validation (`validatePassword()`):**
- errors array
- if `newPassword.length < 8` → push `'Password baru minimal 8 karakter'`
- `hasUpperCase = /[A-Z]/.test(newPassword)`, `hasLowerCase = /[a-z]/.test(newPassword)`, `hasNumber = /[0-9]/.test(newPassword)`; if any false → push `'Password harus mengandung huruf besar, huruf kecil, dan angka'`
- if `newPassword !== confirmPassword` → push `'Password konfirmasi tidak cocok'`
- sets `passwordErrors` and returns `length === 0`

**Password form (`handleUpdatePassword`):**
1. `preventDefault()`, `setPasswordLoading(true)`, `setPasswordErrors([])`.
2. `if (!validatePassword()) { setPasswordLoading(false); return; }` (client-side precheck).
3. `PUT /api/profile/password` with JSON `{ current_password: currentPassword, password: newPassword }`.
4. On failure → `addToast('error', data.error || 'Gagal memperbarui password')`. On success → `addToast('success', 'Password berhasil diubah!')`, clear all three password fields, `setPasswordErrors([])`, and `event.target.reset()` (safety).
5. Catch → `addToast('error', 'Terjadi kesalahan')`, finally `setPasswordLoading(false)`.

> **Dead import:** `profile-form.tsx:5` does `import Swal from 'sweetalert2'`, but `Swal` is never referenced in the file — all feedback goes through `useToast()`. Confirmed by grep across the file.

UI: `.card-brutalist` header `.section-label` `UPDATE_PASSWORD`, body has three `.custom-input-group` fields: current password (lock icon, `type="password"`, required), new password (key icon), confirm password (key icon). Error block renders when `passwordErrors.length > 0` as a `.card-brutalist` with `style={{ borderLeft: '4px solid var(--danger)' }}` containing a `<ul class="mb-0 ps-3">` of errors. Submit `.btn-brutalist` disabled while loading.

## Data Flow

### API: `PUT /api/profile` (`src/app/api/profile/route.ts`)

- Auth: `auth.getUser()` → **401** `{ error: 'Unauthorized' }` if missing.
- `const body = await request.json()`; reads `name`, `email`, `phone_num` (note: the client never sends `name` or `email` here — only `phone_num`).
- Validation:
  - `name` must be non-empty string when present and trimmed length ≥1 → **400** `'Nama harus diisi'` (even if unchanged, the API enforces it)
  - `email` must be non-empty string containing `@` → **400** `'Email tidak valid'`
- **Update profile row:** `supabase.from('profiles').update({ name: name.trim(), phone_num: phone_num || null }).eq('id', user.id)` → **500** with `profileError.message` on failure.
- **Update auth email (if changed):** `if (email !== user.email) { supabase.auth.updateUser({ email: email.trim() }) }` → **500** with `authError.message` on failure.
- Returns `{ success: true }`; catch → **500** `'Terjadi kesalahan server'`. `GET()` → **405**.

> **Note on client/API mismatch:** `ProfileForm` never sends `name` or `email` in the JSON body; it only sends `phone_num`. The API still validates and attempts to update `name`/`email`. That means a malformed request from older code paths would fail, but this form is safe. More directly, changing email requires Supabase Auth confirmation flow in many projects — `auth.updateUser({ email: ... })` may send a confirmation email depending on project settings.

### API: `PUT /api/profile/password` (`src/app/api/profile/password/route.ts`)

- Auth: **401** if unauthenticated.
- Body: `{ current_password, password }`. Missing → **400** `'Password saat ini dan password baru harus diisi'`.
- Password length: `typeof password === 'string' && password.length < 8` → **400** `'Password baru minimal 8 karakter'`.
- Complexity: `hasUpperCase && hasLowerCase && hasNumber` all true → else **400** `'Password harus mengandung huruf besar, huruf kecil, dan angka'` (same rules as client).
- **Verify current password:** `supabase.auth.signInWithPassword({ email: user.email!, password: current_password })`. Failure → **401** `'Password saat ini salah'` (this re-authenticates the user).
- **Update to new password:** `supabase.auth.updateUser({ password })`. Failure → **500** with `updateError.message`. Success → `{ success: true }`. `GET()` → **405**.

This flow is correct for Supabase Auth (re-auth required before sensitive operations in many configurations; signing in with current password verifies ownership).

### Client feedback

- Uses `ToastProvider.addToast(type, text)` exclusively (success/error). Toasts auto-dismiss after 3000ms via a `setTimeout` that filters by id (`src/components/toast-provider.tsx:27–30`).
- Password validation errors are rendered **inline** in the form (not toasts) as a red-left-bordered card list — appropriate for field-level errors.

## Integration Points

- **Toast system:** `useToast()` from `@/components/toast-provider`. Provider is global in `src/app/layout.tsx` wrapping `{children}`.
- **Supabase:** server client for page load, API routes use server client (cookie store). Password change calls `signInWithPassword` and `updateUser` via server client.
- **Auth middleware:** `/profile` is in `protectedRoutes` (`middleware.ts:37–46`) → edge redirect to `/login?redirect=/profile` if not authenticated.
- **Routing:** `router.refresh()` after profile update triggers a re-render of the server page (Next.js App Router) so `profile.name`/`phone_num` reflect the latest DB state.
- **Globals/CSS:** `.custom-input-group`, `.card-brutalist`, `.btn-brutalist`, `.section-label` in `globals.css`. FontAwesome icons used for user/envelope/lock/whatsapp.
- **Tables:** `profiles(id, name, phone_num, is_admin, mapel, ...)`; auth.users updated via `auth.updateUser`.
- **UX note:** the avatar shows the first character of `profile.name` (from DB). Updating profile name requires admin intervention (UI text states this). Updating email requires Auth confirmation emails in typical Supabase projects — the API returns success only if `auth.updateUser` succeeds, but the UI never edits email.