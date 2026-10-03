# src/app/api/

Codemap of the App Router Route Handler layer. 40 route modules, 63 exported HTTP
verbs, no `runtime`/`dynamic` segment config on any handler (all default to the
Node.js runtime — required, since `@react-pdf/renderer`, `xlsx`, and `jszip` are
Node-only and `Buffer` is used directly).

## Responsibility

This folder is the **HTTP boundary + data-access layer** of NgajarYuk Next, the
TypeScript port of the Laravel app `jurnal-kelas`. It replaces Laravel's
controller + form-request + policy layer. Specifically it owns:

1. **Session resolution** — turning the Supabase auth cookie into `user.id`, and
   resolving the caller's `profiles` row.
2. **Authorization** — the `is_admin` gate that mirrors Laravel's `auth` and
   `AdminMiddleware`.
3. **Request validation** — hand-rolled validation of `request.json()` /
   `request.formData()` bodies (there is no Zod layer anywhere in the repo).
4. **Persistence orchestration** — sequencing multi-statement writes that the
   Supabase JS client cannot express in one call (delete-then-insert, upsert
   loops, storage object lifecycle coupled to row lifecycle).
5. **Binary/report generation** — CSV, XLSX, ZIP and PDF rendering that must not
   run in the browser (they stream from the DB and are admin-gated).
6. **Third-party egress** — the Fonnte WhatsApp notification fired after a
   successful teacher check-in.

It is *not* a UI layer: Server Components under `src/app/**/page.tsx` bypass this
folder entirely and query Supabase directly through
`src/utils/supabase/server.ts`.

### Coverage

The surface is uneven. Roughly **half of it has no caller** — see
[Dead surface](#dead-surface) below.

---

## Design

### Supabase client construction (four patterns, one codebase)

| # | Factory | File | Key | Cookie adapter | Used by |
|---|---|---|---|---|---|
| 1 | `createClient(cookieStore)` | `src/utils/supabase/server.ts:8` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `getAll` reads `cookieStore`; **`setAll` is a no-op** | 33 handlers |
| 2 | `createClient(request)` | `src/utils/supabase/middleware.ts:7` | publishable | reads + writes onto the returned `NextResponse` | `api/auth/logout`, `api/auth/session`, `api/schedule/route.ts` |
| 3 | inline `createServerClient` | `api/auth/login/route.ts:20` | publishable | reads `request.cookies`, **writes into `cookieStore`** so `signInWithPassword` can persist the session | login only |
| 4 | `createServiceClient()` | `src/utils/supabase/server.ts:24` | `SUPABASE_SERVICE_ROLE_KEY` | `getAll` returns `[]` (stateless) | `api/schedule/[id]/route.ts` only |

Patterns 1–3 are RLS-scoped: every query runs as the authenticated user, so RLS
policies in `supabase/schema.sql` are the second line of defence behind the
in-handler checks. Pattern 4 is the only RLS bypass.

Note that factory 1's `setAll() {}` is empty. When Supabase rotates a refresh
token mid-request, the new cookie is discarded, so route handlers cannot persist
a refreshed session. Login (pattern 3) is the only place that can.

### Auth: middleware vs in-handler

`middleware.ts` (root, `runtime = "edge"`) guards **pages only**. Its
`protectedRoutes` list is `['/admin', '/absensi', '/journal', '/prevSmes',
'/profile', '/backup', '/explorer', '/export']`, and its `adminRoutes` list adds
`'/backup'`, `'/explorer'`, `'/export'`, `'/admin/import'`,
`'/admin/import-teachers'`. **No `/api` prefix appears in either list**, so
`/api/*` is reachable unauthenticated by default and every handler must — and
mostly does — authenticate itself. Handlers are the only enforcement point for
the API.

The two layers also disagree on mechanism:

- `middleware.ts:78` calls `supabase.from('profiles').select('is_admin')`
  through the **publishable** client.
- Handlers repeat the identical `.from('profiles').select('is_admin').eq('id', user.id).single()` block inline in each exported verb.

The `public.is_admin()` SQL helper (`supabase/schema.sql:269`) exists but is
**never invoked from TypeScript**; every authorization decision re-implements its
logic as a hand-written PostgREST query.

### Admin authorization

The canonical in-handler block, copy-pasted verbatim into ~25 handlers:

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const { data: profile } = await supabase
  .from('profiles').select('is_admin').eq('id', user.id).single()
if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

Because it is duplicated rather than extracted, there is no single choke point and
three handlers omit it (see [Security gaps](#security-gaps-and-defects)).

### Redundant / parallel endpoint families

**a) Students — singular vs plural (redundant, both dead).**

| Route | Verb | Semantics |
|---|---|---|
| `api/admin/student` | `GET` | Paginated list: `search` (`ilike name`), `grade`, `limit` (50), `offset`; returns `{students, total}` |
| `api/admin/student` | `POST` | Create from body `{name, grade, progul}` |
| `api/admin/student` | `DELETE` | Delete from body `{id}` |
| `api/admin/student/update-grade` | `PUT` | `UPDATE students SET grade WHERE id` — id in **body** |
| `api/admin/students/[id]` | `DELETE` | Deletes `attendances` rows first, then `students` |
| `api/admin/students/[id]/update-grade` | `PUT` | Same update — id in **path** |

The plural family is the REST-correct one; the singular family mirrors the old
Laravel `admin/student` controller (verb-in-body, id-in-body). Neither has a
caller — `admin/page.tsx`, `journal/show/page.tsx`, `prevSmes/*` read
`students` directly. The plural `DELETE` additionally performs a manual
`attendances` sweep that `supabase/schema.sql:63` already covers with
`ON DELETE CASCADE` — redundant but harmless.

**b) Absensi deletion — `export/*` vs `admin/absensi/*` (redundant, and divergent).**

| Route | Filter | Removes storage objects? |
|---|---|---|
| `api/admin/absensi/delete-all` | `.delete().neq('id', 0)` | **Yes**, when `?with_image=1` — batches every `foto` path into `storage.from('uploads').remove(paths)` |
| `api/export/delete-all` | `.delete().neq('id', 0)` | **No** — `with_image` branch is a `console.log` stub (`route.ts:41-45`) |
| `api/admin/absensi/delete-by-period` | `.eq('month',…).eq('year',…)` | **Yes**, when `with_image` truthy |
| `api/export/delete-by-period` | `.gte('waktu',…).lte('waktu',…)` | **No** — same `console.log` stub |

The `admin/absensi/*` pair is the live one (called by
`src/app/admin/absensi/absensi-client.tsx:160,194`). The `export/*` pair is the
legacy pair (called by `src/app/export/backup-client.tsx:211,233`) and leaks
orphaned storage objects. Worse, both `export/*` handlers read `month`/`year`
from the body while `admin/absensi/*` reads `month`/`year` from the body but
targets columns that do not exist — see below.

**c) Absensi delete — collection vs resource.** `DELETE /api/admin/absensi`
(id in body) and `DELETE /api/admin/absensi/[id]` (id in path) are byte-for-byte
equivalent apart from id extraction. Only the `[id]` variant is called.

**d) Absensi update — collection vs resource.** `PUT /api/admin/absensi` takes
`{id, ...updates}`; the client instead calls `PUT /api/admin/absensi/${id}`,
but `admin/absensi/[id]/route.ts` exports **only `DELETE`**. The inline-edit
feature returns 405.

**e) PDF documents defined twice.** `api/export/pdf/rekap-presensi/route.tsx`
and `api/export/pdf/rekap-kbm/route.tsx` each define a local
`RekapPresensiDocument` / `RekapKBMDocument` component and their own
`Font.register` + `StyleSheet.create`. `src/components/pdf/rekap-presensi-pdf.tsx`
and `src/components/pdf/rekap-kbm-pdf.tsx` exist as apparently-intended shared
extractions but are imported by nothing.

### Error / response conventions

- All JSON responses use `NextResponse.json(body, { status })`.
- Error shape is uniformly `{ error: string }`. There is no `code`, no
  field-level detail, no request id.
- Message language is Indonesian for validation/business errors and English for
  auth (`'Unauthorized'`, `'Forbidden'`, `'Method not allowed'`, `'Invalid type'`,
  `'Data belum lengkap'`-style varies).
- Every handler is wrapped in `try { ... } catch { return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 }) }`.
  The `catch` binds no identifier, so **the underlying exception is never
  logged** — only 4 handlers (`admin/teachers/[id]`, `absensi`,
  `admin/absensi`, `schedule/import`) log to `console.error` first.
- Success shape is `{ success: true }`, optionally with a payload
  (`{ success: true, student }`, `{ success: true, teachers }`,
  `{ success: true, imported, format }`, `{ success: true, message }`).
- List endpoints return a named collection plus `total` from
  `.select('*', { count: 'exact' })`.
- Binary endpoints return a raw `NextResponse` with `Content-Type` +
  `Content-Disposition: attachment; filename=…` — `text/csv`,
  `application/zip`, `application/pdf`,
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- Five handlers add an explicit `export async function GET()` returning 405
  (`auth/login`, `auth/logout`, `import-students`, `profile`,
  `profile/password`) — a defensive pattern for GET-able POST endpoints.
  `schedule/preview` does the same.
- The catch-all 500 handler in `export/delete-all` and `export/delete-by-period`
  `throw new Error(deleteError.message)` and then swallow it in the outer
  `catch`, converting a precise Supabase error into the generic 500.

---

## Endpoint Map

Auth levels: **public** (no session required) · **authenticated** (any logged-in
`profiles` row) · **admin** (in-handler `is_admin` check present).

### Auth — `src/app/api/auth/`

| Method | Path | Auth | Purpose | Tables |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | public | `formData` email+password → `signInWithPassword`; persists cookies via inline client | `auth.users` |
| `GET` | `/api/auth/login` | public | 405 stub | — |
| `POST` | `/api/auth/logout` | public | `signOut()`, then returns a **302 redirect** to `/login` carrying cleared cookies | `auth.users` |
| `GET` | `/api/auth/logout` | public | 405 stub | — |
| `GET` | `/api/auth/session` | public | Returns `{authenticated, user:{id,email,name,is_admin}}`; 401 when anonymous | `profiles` (`name`, `is_admin`) |

### Profile — `src/app/api/profile/`

| Method | Path | Auth | Purpose | Tables |
|---|---|---|---|---|
| `PUT` | `/api/profile` | authenticated | Self-service update: `profiles.name`/`phone_num`; if `email !== user.email`, also `auth.updateUser({email})` | `profiles`, `auth.users` |
| `GET` | `/api/profile` | authenticated | 405 stub | — |
| `PUT` | `/api/profile/password` | authenticated | Verifies current password by **re-signing-in**, enforces ≥8 chars + upper/lower/digit, then `auth.updateUser({password})` | `auth.users` |

Note: `PUT /api/profile` writes `profiles` first and only then attempts the auth
email change — a failed email change leaves the profile mutated and returns 500.

### Teacher attendance check-in — `src/app/api/absensi/`

| Method | Path | Auth | Purpose | Tables / Storage |
|---|---|---|---|---|
| `POST` | `/api/absensi` | authenticated | GPS geofence check-in; photo upload; duplicate-today guard; WhatsApp notify | `profiles`, `schedules`, `absensis`; bucket `uploads` |

Only this route can create an `absensis` row from organic use.

### Admin — students

| Method | Path | Auth | Purpose | Tables |
|---|---|---|---|---|
| `GET` | `/api/admin/student` | admin | Paginated list; `search`→`ilike('name',…)`, `grade`→`eq('grade', grade.toUpperCase())`, default `limit=50&offset=0`; returns `{students, total}` | `students` |
| `POST` | `/api/admin/student` | admin | Insert `{name, grade: upper, progul ?? null}` | `students` |
| `DELETE` | `/api/admin/student` | admin | Delete by body `{id}` | `students` |
| `PUT` | `/api/admin/student/update-grade` | admin | `UPDATE students SET grade` — id in body | `students` |
| `DELETE` | `/api/admin/students/[id]` | admin | Delete `attendances` rows, then `students` row — id in path | `attendances`, `students` |
| `PUT` | `/api/admin/students/[id]/update-grade` | admin | `UPDATE students SET grade` — id in path | `students` |

### Admin — teachers / profiles

| Method | Path | Auth | Purpose | Tables |
|---|---|---|---|---|
| `GET` | `/api/admin/teachers` | admin | List non-admin teachers: `.eq('is_admin', false).order('name')` | `profiles` |
| `POST` | `/api/admin/teachers` | admin | `auth.admin.createUser({email, password, email_confirm:true})`, then `profiles` insert `{id, name, is_admin:false, phone_num}`; **rolls back** via `auth.admin.deleteUser` if the profile insert fails | `profiles`, `auth.users` |
| `GET` | `/api/admin/teachers/[id]` | admin | Single profile row; 404 if absent | `profiles` |
| `PUT` | `/api/admin/teachers/[id]` | admin | Patch `profiles.name`/`phone_num` (only keys present), plus `auth.admin.updateUserById` for `email` (error only logged) and for `password` (error → 500) | `profiles`, `auth.users` |
| `DELETE` | `/api/admin/teachers/[id]` | admin | Deletes `absensis` where `user_id=id`, deletes `profiles`, then `auth.admin.deleteUser` | `absensis`, `profiles`, `auth.users` |
| `PUT` | `/api/admin/teachers/[id]/mapel` | admin | `UPDATE profiles SET mapel` (raw JSONB passthrough, `undefined` rejected) | `profiles` |
| `PUT` | `/api/admin/teachers/[id]/make-admin` | admin | `is_admin := true` | `profiles` |
| `PUT` | `/api/admin/teachers/[id]/remove-admin` | admin | `is_admin := false` | `profiles` |

`make-admin`/`remove-admin` accept any `[id]` including the caller's own, so an
admin can self-demote (locking themselves and all admins out of `/admin`) and
can promote anyone with no confirmation step.

### Admin — absensi

| Method | Path | Auth | Purpose | Tables / Storage |
|---|---|---|---|---|
| `GET` | `/api/admin/absensi` | admin | List; `year`, `month`, `user_id`, `search` (read but **never applied**), `limit=100`, `offset=0`; ordered `waktu desc`; returns `{absensis, total}` | `absensis` |
| `PUT` | `/api/admin/absensi` | admin | Mass-assignment patch: `const { id, ...updates } = await request.json()` then `.update(updates).eq('id', id)` | `absensis` |
| `DELETE` | `/api/admin/absensi` | admin | Delete by body `{id}`; removes the storage object from `foto.split('/').pop()` first | `absensis`; bucket `uploads` |
| `DELETE` | `/api/admin/absensi/[id]` | admin | Same, id from path | `absensis`; bucket `uploads` |
| `POST` | `/api/admin/absensi/delete-all` | admin | `?with_image=1` removes every `foto` object, then `.delete().neq('id', 0)` | `absensis`; bucket `uploads` |
| `POST` | `/api/admin/absensi/delete-by-period` | admin | Body `{month, year, with_image}`; deletes storage objects then `.eq('month').eq('year')` | `absensis`; bucket `uploads` |

### Admin — teacher import — `src/app/api/admin/import-teachers/`

| Method | Path | Auth | Purpose | Tables |
|---|---|---|---|---|
| `POST` | `/api/admin/import-teachers` | admin | XLSX → teachers + `profiles.mapel`; then **prunes** any non-admin profile whose auth email is absent from the file | `profiles`, `auth.users` |

Pipeline: `formData` → `await import('xlsx')` → `xlsx.read(buffer,{type:'buffer'})`
→ `sheet_to_json(sheet,{header:1})` → header row lowercased into a key map →
`detectFormat(headers, rows)` classifies the sheet as format **A** (columns are
subjects) or **B** (columns are `7a`/`8b`/`9` class headers) or `null` (treated as
B) → per row: resolve `nama`/`email`/`password` and phone from
`hp|telepon|wa|whatsapp|phone|num|number` → find-or-create auth user → build
`rawItems` of `{mapel, kelas}` → `flattenClasses` (expands ranges like `A-F`→`ABCDEF`
via `charCodeAt` loop, then `matchAll(/([789])\s*([A-Za-z]+)?/g)` to split
`"7 ABC"` into `7A`,`7B`,`7C`) → `normalizeMapel` → `profiles.upsert`.
`mapSubject` resolves against a 60-entry local `MAPEL_MAPPING` table with fallback
to `normalizeSubject`.

### Schedule — `src/app/api/schedule/`

| Method | Path | Auth | Purpose | Tables |
|---|---|---|---|---|
| `GET` | `/api/schedule` | authenticated | List, ordered `class_name, day, period`; optional `class`→`eq('class_name')`, `day`→`eq('day')` | `schedules` |
| `POST` | `/api/schedule` | admin | Insert one row; `subject_display` defaults to `subject.toUpperCase()` | `schedules` |
| `GET` | `/api/schedule/[id]` | admin\* | Single row by `parseInt(id)`; 404 if absent. **\*See defect D1 — unreachable** | `schedules` |
| `PUT` | `/api/schedule/[id]` | admin\* | Full-row update of all 7 schedule columns | `schedules` |
| `DELETE` | `/api/schedule/[id]` | admin\* | Delete by `parseInt(id)` | `schedules` |
| `POST` | `/api/schedule/preview` | authenticated | Reads every sheet's top-left 5×8 cell window for a grid preview; returns `{status:'success', sheets, sheetNames}` | — (file only) |
| `POST` | `/api/schedule/import` | admin | v9.4 workbook → teacher accounts + full schedule rebuild | `schedules`, `profiles`, `auth.users` |

`schedule/preview` is **not** admin-gated (upload-and-read-only, but still an
unauthenticated-cost surface; it is not in `middleware.ts`'s list either).

`schedule/import` details: requires `formData.get('file_v94')` **and**
`confirm === 'on'`; then `(1)` `readClassesSheet` / `readTeachersSheet` /
`readLessonsSheet` → `(2)` `importTeachersFromV94` → `(3)`
`supabase.from('schedules').delete().neq('id', 0)` — a full table wipe whose error
is only `console.error`'d, so import proceeds even if the wipe failed →
`(4)` format branch: `hasAvailableTeachersFormat` → `processAvailableTeachersFormat`,
else loop `SUBJECT_SHEETS` → `processSubjectSheet` → `(5)` `LEADERSHIP_SHEETS` →
`processLeadershipSheet` → `(6)` `WITHOUT_TEACHER_SHEETS` →
`processWithoutTeacherSheet` → `(7)` single bulk
`upsert(allRecords, {onConflict: 'class_name,day,period'})`.

That `onConflict` target requires a unique constraint on
`(class_name, day, period)`, but `supabase/schema.sql:111` defines only a plain
index `idx_schedules_class_day ON (class_name, day)` — see D3.

`importTeachersFromV94` derives emails via `generateEmailFromName(name)` and sets
every teacher password to the literal `'abbs2024'`.

### Journal (KBM) — `src/app/api/journal/`

| Method | Path | Auth | Purpose | Tables |
|---|---|---|---|---|
| `POST` | `/api/journal/save-note` | authenticated | Single-note `upsert` on `onConflict: 'class,subject,date'`; defaults `checked: true`, `teacher_id: user.id` | `notes` |
| `POST` | `/api/journal/save-all?class=<name>` | authenticated | Bulk: loop `attendance[]` → `attendances.upsert` on `'student_id,day,month,year'`; loop `kbm[]` → `notes.upsert` on `'class,subject,date'`. Aborts the whole request 500 on the first row error | `attendances`, `notes` |
| `GET` | `/api/journal/export` | admin | Two-sheet XLSX: sheet `Absensi` (student × days 1–31 + S/I/A counts) and sheet `KBM` (`Tanggal/Mapel/Guru/Catatan`); `xlsx.write(wb,{type:'buffer',bookType:'xlsx'})` | `students`, `attendances`, `notes` |

`save-note` and `save-all` do not verify that `teacher_id` belongs to the caller —
any authenticated user can write journal entries attributed to any teacher.
This is consistent with the notes RLS policy ("Authenticated users can
update notes", `schema.sql:234`).

### Export / backup / PDF — `src/app/api/export/`

| Method | Path | Auth | Purpose | Tables |
|---|---|---|---|---|
| `GET` | `/api/export?type=csv` | admin | CSV of `absensis`; optional `month`+`year` → `gte/lte('waktu', …-01 / …-31)` | `absensis` |
| `GET` | `/api/export?type=zip` | admin | Fetches every non-null `foto` URL server-side and zips them under `uploads/` via `jszip` `generateAsync({type:'nodebuffer'})` | `absensis` (+ HTTP fetch of Storage) |
| `GET` | `/api/export` | admin | `?type` other than `csv`/`zip` → 400 `Invalid type` | — |
| `GET` | `/api/export/export-lokasi?year=` | admin | Full-year `absensis` → CSV `ID,Nama,Unit,Lokasi (GPS),Alamat,Waktu,Akurasi` | `absensis` |
| `GET` | `/api/export/export-waktu?period=&year=` | admin | Teacher × day matrix CSV; `period` parsed as `startMonth-endMonth` → `-21`/`-20` bounds; scores `S`=1, `I`=0.5, `A`=0, defaults missing days to `'A'` | `profiles`, `absensis` |
| `GET` | `/api/export/pdf/rekap-presensi?class=&semester=&year=` | admin | `@react-pdf/renderer` A4-landscape S/I/A recap; semester→month bounds (1–6 / 7–12); for bare `'7'/'8'/'9'` uses `ilike('grade', '7%')` to sweep all `7x` classes | `students`, `attendances` |
| `GET` | `/api/export/pdf/rekap-kbm?class=&semester=&year=` | admin | `@react-pdf/renderer` schedule summary + KBM notes grouped by date; schedules fetched with `.or(\`class_name.eq.${grade},class_name.eq.${grade}\`)` where `gradeLevel = grade.replace(/[^0-9]/g,'')` | `notes`, `schedules` |
| `POST` | `/api/export/backup-save` | admin | Per-row find-or-create over `absensis` by `user_id` + `waktu` day window; updates `value`, or inserts a placeholder row with `lokasi:'-'`, `alamat:'-'`, `foto:null`, `akurasi:null`, `waktu:\`${date}T00:00:00\`` | `absensis`, `profiles` |
| `POST` | `/api/export/delete-all` | admin | `.delete().neq('id', 0)`; `with_image` is a no-op log | `absensis` |
| `POST` | `/api/export/delete-by-period` | admin | Calendar-month range on `waktu`; `with_image` is a no-op log | `absensis` |

Both PDF routes `Font.register` the same Inter woff2 URL
(`fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff`) at
module scope, then `renderToBuffer(element)` → `new NextResponse(new Uint8Array(pdfBuffer), …)`.

### Explorer — `src/app/api/explorer/`

All target the same `uploads` bucket. All are admin-gated in-handler. All have
no caller — see D4.

| Method | Path | Auth | Purpose | Storage |
|---|---|---|---|---|
| `POST` | `/api/explorer/upload` | admin | `formData` `file` + `path`; ≤10 MB; MIME prefix allow-list `image/`, `application/pdf`, `application/zip`, `application/x-zip-compressed`, `text/`; `upload(upsert: true)` to `` `${path}/${file.name}` `` | `uploads` |
| `POST` | `/api/explorer/folder` | admin | Validates `newFolder` against `/^[a-zA-Z0-9_-]+$/`, then uploads a zero-byte `.gitkeep` to materialise the directory | `uploads` |
| `POST` | `/api/explorer/rename` | admin | Validates `newName` against `/^[a-zA-Z0-9_.-]+$/`; `download(oldPath)` → `upload(newPath, upsert:true)` → `remove([oldPath])` | `uploads` |
| `DELETE` | `/api/explorer/delete-file` | admin | `remove([path])` for a single object | `uploads` |
| `DELETE` | `/api/explorer/delete-folder` | admin | `list(path)` then `remove()` of every child — **non-recursive** | `uploads` |

### Student import — `src/app/api/import-students/`

| Method | Path | Auth | Purpose | Tables |
|---|---|---|---|---|
| `POST` | `/api/import-students` | **authenticated (no admin check)** | Multi-sheet XLSX → `students.upsert({name, grade: upper}, {onConflict:'name,grade'})`; skips rows with <2 cells, blank name/grade, and header rows where col 0 is `nama`/`name`; returns `{success, imported, errors?}` | `students` |
| `GET` | `/api/import-students` | authenticated | 405 stub | — |

### Dead surface

Verified by grepping `src/` for each path outside `src/app/api`. No caller exists
for any of:

`/api/export/pdf/rekap-presensi` · `/api/export/pdf/rekap-kbm` ·
all 5 `/api/explorer/*` · all 6 `/api/admin/student*` and
`/api/admin/students/*` · `/api/schedule/[id]` (all 3 verbs) ·
`/api/admin/teachers/[id]/mapel` is called, but `/api/auth/session` is not.

---

## Data & Control Flow

### Flow 1 — Teacher check-in: `POST /api/absensi`

`src/app/absensi/absensi-form.tsx:231` → `fetch('/api/absensi', {method:'POST', body:{lokasi, alamat, foto}})`.

1. `createClient(await cookies())` (factory 1, publishable key, RLS-scoped).
2. `auth.getUser()` → 401 `{error:'Unauthorized'}` if anonymous. No admin check
   — any teacher may check in.
3. Body destructured `{lokasi, alamat, foto}`; any falsy → 400.
4. **Geofence.** `lokasi.split(',')` → `lat`/`lon`, `isNaN` guard → 400.
   `haversineDistance(lat, lon, -7.5564, 110.8347)` (R = 6371000 m) against
   `MAX_RADIUS = 1000`. Over radius → **403** with the computed distance
   interpolated into the message.
5. **Idempotency.** Select `id, waktu` from `absensis` for
   `.eq('user_id', user.id)` inside
   `[today 00:00:00, today 23:59:59.999)` via `.maybeSingle()`; hit → **409**.
6. **Photo.** Strips the `data:image/…;base64,` prefix, `Buffer.from(...,'base64')`,
   >5 MB → 400, then `foto.match(/data:image\/(\w+);base64/)?.[1] || 'image/png'`
   against `['image/jpeg','image/png','image/gif','image/webp']` → 400 otherwise.
7. **Profile.** `profiles` select `name, phone_num`; missing → 404.
8. **Storage.** Key is
   `` `${name.replace(/[^a-zA-Z0-9_.-]/g,'_')}@${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.${mimeType.split('/')[1]}` ``
   → `storage.from('uploads').upload(fileName, buffer, {contentType, upsert:false})`;
   error → 500. Then `getPublicUrl(fileName).publicUrl`.
9. **Insert.** `absensis.insert({user_id, nama: profile.name,
   unit:'SMP ABBS Surakarta', lokasi, alamat, foto: publicUrl, waktu: now ISO})`.
   **`value` and `akurasi` are never set** → both `NULL`.
10. **WhatsApp (fire-and-forget).** `phone_num` stripped to digits; if
    `FONNTE_API_KEY` is set, builds a message containing the teacher's name and
    today's schedule — `schedules.select('period, subject, class_name')` with
    `.ilike('teacher', '%'+profile.name+'%').eq('day', dayEn)` where `dayEn` is
    the **English** weekday from `toLocaleDateString('en-US',{weekday:'long'})`,
    so it matches the `schedules.day` convention — then
    `fetch('https://api.fonnte.com/send', {method:'POST', headers:{Authorization: key},
    body:{target, message, countryCode:'62', device?}})` **without `await`**, inside
    its own try/catch. The response body is discarded and the request is not
    guaranteed to complete before the handler returns 200.
11. `NextResponse.json({success:true})`.

Consumers of the resulting row: `GET /api/admin/absensi` (list),
`GET /api/export?type=csv|zip`, `export-lokasi`, `export-waktu`,
`pdf/rekap-*`, and the storage-cleanup paths.

### Flow 2 — Admin teacher CRUD + `mapel` assignment

`src/app/admin/tsmanager/ts-manager-client.tsx` drives this domain;
`src/app/admin/teachers/teacher-table.tsx` and
`src/app/admin/user-table.tsx` hit the same endpoints.

**Create** (`POST /api/admin/teachers`, `ts-manager-client.tsx:455`):
1. `formData`/JSON `{name, email, password, phone_num}`; missing any of the first
   three → 400.
2. `supabase.auth.admin.createUser({email, password, email_confirm:true})` —
   **service-role API called on the publishable-key client** (see D2).
3. `profiles.insert({id: authData.user.id, name, is_admin:false, phone_num: phone_num || null})`.
4. On profile failure: `auth.admin.deleteUser(authData.user.id)` as a compensating
   rollback, then 500 with `profileError.message`.
5. `{success:true, user: authData.user}`.

**Assign subjects** (`PUT /api/admin/teachers/[id]/mapel`,
`ts-manager-client.tsx:174`): body `{mapel}`; `undefined` → 400
(`null`/`[]`/`{}` all pass); `.update({mapel}).eq('id', id)` straight into the
JSONB column. The canonical shape comes from `normalizeMapel` in
`src/lib/subject-normalizer.ts:52`, which produces
`Record<string, string[]>` — matching `MapelAssignment` in `src/types/index.ts:83`.

**Promote/demote** (`PUT …/make-admin` / `…/remove-admin`, called from three
components): body-less; flips `is_admin`. The response is `{success:true}` and
the client refetches.

**Delete** (`DELETE /api/admin/teachers/[id]`): `absensis.delete().eq('user_id',id)`
→ `profiles.delete().eq('id',id)` → `auth.admin.deleteUser(id)`. The first two
return errors that are **not checked**; only the auth deletion's error surfaces.
Deleting the last admin has no guard.

### Flow 3 — v9.4 schedule import: `POST /api/schedule/import`

`src/app/schedule/import-form.tsx:71` posts `multipart/form-data` with
`file_v94` and `confirm='on'`.

1. Admin gate (factory 1).
2. `await import('xlsx')` → `xlsx.read(arrayBuffer, {type:'buffer'})`.
3. **Reference extraction** from `src/lib/v94-parser.ts`:
   `readClassesSheet(workbook)` → class roster; `readTeachersSheet` →
   `nicknameMap.nicknameToFullname`; `readLessonsSheet(workbook, nicknameMap)` →
   `teacherMap`, `teacherToClassesSubjects`, `teacherNickToClassesSubjects`,
   `leadershipParticipants`.
4. **Teachers first** (`importTeachersFromV94`): inverts `teacherMap`
   (`"kelas|mapel" → [nicknames]`) into `nicknameToMapel`, then walks the
   `Teachers` sheet (full name col 1, short/nickname col 2, `break` on first
   blank). Per teacher: `generateEmailFromName(name)`,
   `normalizeMapel(mapelData)`, find-or-create the auth user (**password forced to
   `'abbs2024'`**), `profiles.upsert({id, name, is_admin:false, mapel})`.
   Finally the **prune pass**: every `profiles` row with `is_admin=false` whose
   auth email is not in `importedEmails` is deleted from `profiles` and from
   `auth.users`.
5. **Wipe:** `schedules.delete().neq('id', 0)`.
6. **Parse** into `ScheduleRecord[]` via `src/lib/bell-schedule.ts` helpers —
   either `processAvailableTeachersFormat` or a loop over `SUBJECT_SHEETS` →
   `processSubjectSheet`, then `LEADERSHIP_SHEETS` → `processLeadershipSheet`
   (participants resolved through `LEADERSHIP_CODE_OF_SHEET`), then
   `WITHOUT_TEACHER_SHEETS` → `processWithoutTeacherSheet`.
7. **One bulk write:** `schedules.upsert(allRecords, {onConflict:'class_name,day,period'})`;
   error → 500 with `upsertError.message`. `imported === 0` → 400 with the
   "pastikan file v9.4.xlsx sesuai format" message.
8. `{success:true, message, teachers, schedules}`.

Read-back path: `GET /api/schedule?class=&day=`, plus
`pdf/rekap-kbm` and `POST /api/absensi`'s WhatsApp schedule lookup.

### Flow 4 — PDF rekap (dead but complete): `GET /api/export/pdf/rekap-presensi`

1. Admin gate, then `class`/`semester`/`year` from `searchParams` with defaults
   (`semester` inferred as `getMonth() <= 6 ? 1 : 2`).
2. `students` — `.eq('grade', grade)` for a lettered class, or
   `.ilike('grade', \`${grade}%\`)` when `grade ∈ {7,8,9}` to catch `7A`…`7F`.
   Empty → 404 `Tidak ada siswa di kelas ini`.
3. `attendances.select('*').in('student_id', ids).eq('year', year).gte('month', startMonthBound).lte('month', endMonthBound)`.
   Note `.in()` with a full student roster can exceed PostgREST URL length for
   large classes.
4. Pivot into `AttendanceData = Record<studentId, Record<month, Record<day, value>>>`.
5. JSX → `renderToBuffer(<RekapPresensiDocument/>)` → `new NextResponse(new Uint8Array(buf), {Content-Type:'application/pdf', Content-Disposition:…})`.
   `renderToBuffer` failures are caught → generic 500 (the buffer, not the cause,
   is discarded).

### Flow 5 — Explorer (dead UI path)

`src/app/explorer/page.tsx` is a Server Component that lists
`storage.from('uploads').list(currentPath, {limit:100, offset:0, sortBy:{column:'name',order:'asc'}})`
and renders plain HTML forms whose `action`/`formAction` point at
`/explorer/folder`, `/explorer/upload`, `/explorer/rename`,
`/explorer/delete-file`, `/explorer/delete-folder` — **without ever calling the
API routes**. See D4.

---

## Integration Points

### Consumers (verified by `grep -rn "fetch('/api|fetch(\`/api"` across `src/`)

| Domain | Endpoints actually called | Caller |
|---|---|---|
| auth | `POST /api/auth/login` | `src/app/login/login-form.tsx:19` |
| auth | `POST /api/auth/logout` | `src/components/logout-button.tsx:41`, `src/components/app-shell.tsx:87`, `src/components/admin/sidebar.tsx:91`, `src/components/admin/topbar.tsx:54` |
| profile | `PUT /api/profile`, `PUT /api/profile/password` | `src/app/profile/profile-form.tsx:37,97` |
| absensi | `POST /api/absensi` | `src/app/absensi/absensi-form.tsx:231` |
| admin/absensi | `GET`, `DELETE [id]`, `DELETE delete-all`, `POST delete-by-period`, `PUT [id]` | `src/app/admin/absensi/absensi-client.tsx:55,134,160,194,231` |
| admin/teachers | `GET`, `POST`, `DELETE [id]`, `PUT [id]/make-admin`, `PUT [id]/remove-admin` | `teacher-table.tsx`, `user-table.tsx`, `ts-manager-client.tsx` |
| admin/teachers | `GET [id]`, `PUT [id]/mapel`, `POST` | `src/app/admin/tsmanager/ts-manager-client.tsx:41,131,174,455` |
| admin/import-teachers | `POST` | `src/app/admin/import-teachers/teacher-import-form.tsx:42` |
| import-students | `POST` | `src/app/admin/import/import-form.tsx:80` |
| schedule | `GET /api/schedule`, `POST /api/schedule/preview`, `POST /api/schedule/import` | `src/app/schedule/page.tsx:24,45`, `src/app/schedule/import-form.tsx:30,71` |
| journal | `POST save-all?class=`, `POST save-note`, `GET export` | `src/app/journal/show/journal-form.tsx:187,220,314` |
| export | `GET export-waktu`, `GET export-lokasi`, `GET export?type=zip` (all via `<a href>` download links) | `src/app/export/page.tsx:217,223,230` |
| export | `POST backup-save` (×2 call sites), `POST delete-all`, `POST delete-by-period` | `src/app/export/backup-client.tsx:140,173,211,233` |
| explorer, pdf, students | — | **none** |

`src/app/admin/page.tsx`, `src/app/journal/show/page.tsx`,
`src/app/prevSmes/presensi/page.tsx`, `src/app/prevSmes/show/page.tsx` and
`src/app/explorer/page.tsx` read Supabase **directly** via
`createClient(cookieStore)` in Server Components. This is why the whole
`admin/student*` and `admin/students/*` family has no consumer: the list/create
/grade-change UIs moved to direct server-side queries, and the routes were never
deleted.

### Internal dependencies

| Dependency | Used by |
|---|---|
| `@/utils/supabase/server` — `createClient` | 33 handlers |
| `@/utils/supabase/server` — `createServiceClient` | `api/schedule/[id]` only |
| `@/utils/supabase/middleware` — `createClient(request)` | `api/auth/logout`, `api/auth/session`, `api/schedule/route.ts` |
| `@supabase/ssr` — `createServerClient`, `parseCookieHeader` | `api/auth/login` (inline) |
| `@/lib/subject-normalizer` — `normalizeSubject`, `normalizeMapel` | `admin/import-teachers`, `schedule/import` |
| `@/lib/v94-parser` — `readClassesSheet`, `readTeachersSheet`, `readLessonsSheet`, `processSubjectSheet`, `processLeadershipSheet`, `processWithoutTeacherSheet`, `processAvailableTeachersFormat`, `hasAvailableTeachersFormat`, `generateEmailFromName` | `schedule/import` |
| `@/lib/bell-schedule` — `SUBJECT_SHEETS`, `LEADERSHIP_SHEETS`, `LEADERSHIP_CODE_OF_SHEET`, `WITHOUT_TEACHER_SHEETS`, `ScheduleRecord` | `schedule/import` |
| `@/lib/period-system` — **not imported by any route** | only `src/components/period-badge.tsx:3` |
| `xlsx` (dynamic `await import`) | `admin/import-teachers`, `import-students`, `schedule/preview`, `schedule/import`, `journal/export` |
| `jszip` (dynamic) | `export/route.ts` (`type=zip`) |
| `@react-pdf/renderer` — `renderToBuffer`, `Document`, `Page`, `Text`, `View`, `StyleSheet`, `Font` | `export/pdf/rekap-presensi`, `export/pdf/rekap-kbm` |
| `@/types` `Schedule`, `Absensi`, `Attendance`, `Note`, `MapelAssignment` | consumed by client components; route handlers are largely untyped (`Record<string, unknown>`, inline `any`-ish shapes) |
| `Buffer` (Node global) | `absensi`, `explorer/folder`, `export` (CSV/ZIP/PDF byte bodies) |

`src/lib/period-system.ts` is the intended home of the 21st-to-20th payroll cycle
(`PERIODS`, `getCurrentPeriod`, `getPeriodDateRange`, `getSemesterMonths`), but
**every route re-derives period math inline** instead: `export/export-waktu`
does `period.split('-')` → `-21`/`-20`; `export/backup-save` duplicates that
identically; both PDF routes hardcode `semester === 1 ? 1 : 7`. The exported
`Period`/`getPeriodDateRange` are dead in the API layer.

`src/lib/utils.ts` (`cn`) and `src/components/pdf/*` have no API-layer consumer.

### External services

- **Fonnte WhatsApp API** — `POST https://api.fonnte.com/send`, `Authorization: <FONNTE_API_KEY>`, optional `FONNTE_DEVICE_ID`, `countryCode:'62'`. `absensi/route.ts:186` only.
- **Supabase Storage** — single bucket `uploads`, shared by attendance photos
  *and* the file explorer. No signed URLs are used anywhere, despite
  `supabase/schema.sql:306` documenting the bucket as `Public: false (use signed URLs)`.
- **Google Fonts CDN** — the Inter woff2 is fetched at render time by
  `@react-pdf/renderer` in both PDF routes; PDF generation depends on outbound
  network access.

---

## Security gaps and defects

### D0 — Missing admin gate on a mutating endpoint

**`POST /api/import-students`** (`route.ts:5-17`) checks only `user`, never
`is_admin`. Any authenticated teacher can mass-`upsert` into `students`. RLS
policy `"Admins can insert students"` (`schema.sql:168`) is the only thing
stopping the write, so the failure mode is a confusing PostgREST 403 rather than
a clean 403 — and any future relaxation of that policy immediately opens
student-roster tampering to all teachers. `/import-students` is also absent from
`middleware.ts`'s admin list.

Same class, lower severity: **`POST /api/schedule/preview`** has no admin gate
(read-only on the uploaded file).

### D1 — `schedule/[id]` is unreachable and RLS-bypassing

All three verbs in `api/schedule/[id]/route.ts` build their client with
`createServiceClient()` — service-role key, `getAll()` returns `[]` — and then
immediately call `supabase.auth.getUser()`. With no cookie adapter there is no
session to read, so `user` is always `null` and every call returns
**401 Unauthorized**. If it ever did authenticate, the data access would bypass
RLS entirely, which is why the in-handler `is_admin` query would also be
meaningless. The route has no caller, which is the only reason this is dormant.

### D2 — `auth.admin.*` on the publishable key

`api/admin/teachers/route.ts:80`, `api/admin/teachers/[id]/route.ts:96,108,156`,
`api/admin/import-teachers/route.ts:264,271,275,347,350` and
`api/schedule/import/route.ts:210,217,221,256,259` all call
`supabase.auth.admin.createUser / updateUserById / deleteUser / listUsers /
getUserById` on a client constructed by
`createClient(cookieStore)`, which uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
The GoTrue admin namespace requires the `service_role` JWT; with the publishable
key these calls return an authorization error. `createServiceClient()` exists in
the same file for exactly this purpose and is used only by the broken
`schedule/[id]`. Consequence: teacher creation, teacher deletion, teacher email/
password update, teacher import, and the v9.4 teacher sync are all expected to
fail at runtime. The compensating rollback in `POST /api/admin/teachers`
(`auth.admin.deleteUser`) fails for the same reason, so a profile insert failure
leaves an orphaned auth user.

Additionally, `listUsers()` inside a per-row loop in both importers is
unpaginated — `listUsers()` defaults to 50, so any school with more teachers
than that will silently fail to match existing accounts and attempt duplicate
creation on every import run.

### D3 — `onConflict` targets with no unique constraint

`supabase/schema.sql` creates only plain (non-unique) indexes for:

| `onConflict` used by | Required unique index | Actual DDL |
|---|---|---|
| `notes` → `'class,subject,date'` (both `journal/save-note` and `journal/save-all`) | none | `CREATE INDEX idx_notes_class_subject_date` (`schema.sql:92`) — **not unique** |
| `schedules` → `'class_name,day,period'` (`schedule/import`) | none | `CREATE INDEX idx_schedules_class_day` (`schema.sql:111`, also wrong column set) — **not unique** |

PostgREST turns these into `ON CONFLICT (...) DO UPDATE`, which Postgres rejects
with *"ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint"*.
Journal saving is therefore expected to 500 on every write. By contrast
`attendances.upsert({onConflict:'student_id,day,month,year'})` **is** backed by
`idx_attendances_unique` (`schema.sql:73`), and
`students.upsert({onConflict:'name,grade'})` by `idx_students_name_grade`
(`schema.sql:35`) — those two are correct.

### D4 — Explorer UI and explorer API cannot talk to each other

`src/app/explorer/page.tsx` drives the API with raw HTML forms:

| UI markup | Sends | Route exports | Result |
|---|---|---|---|
| `<form method="GET" formAction="/explorer/folder">` (`page.tsx:88-103`) | `GET` | `POST` | 405 |
| `<form method="GET" formAction="/explorer/upload">` (`page.tsx:107-122`) | `GET` | `POST` | 405 |
| `<a href="/explorer/rename?path=…">` (`page.tsx:167`) | `GET` | `POST` | 405 |
| `<form method="POST" action="/explorer/delete-file?path=…">` (`page.tsx:173-178`) | `POST` | `DELETE` | 405 |

Additionally every one of these routes reads its payload from
`await request.json()`, while the UI sends `?path=` in the query string. So even
after fixing the verbs, the routes would see `undefined` paths. The explorer is
effectively a read-only page.

### D5 — Absensi `GET`/delete handlers filter on non-existent columns

`supabase/schema.sql:40-53` defines `absensis` with `waktu TIMESTAMPTZ` and **no
`year`/`month` columns**. But:

- `GET /api/admin/absensi` does `.eq('year', Number(year))` and
  `.eq('month', Number(month))` when those params are present
  (`route.ts:43,47`) → PostgREST `42703 column does not exist`.
- `POST /api/admin/absensi/delete-by-period` does `.eq('month', month).eq('year', year)`
  (`route.ts:55-56`) → same error, so **period deletion never deletes anything**.

Every other absensi filter in the codebase correctly uses `gte/lte('waktu', …)`:
`export/delete-by-period`, `export?type=csv`, `export-lokasi`, `export-waktu`,
`backup-save`. The two offenders are leftovers from the legacy schema.

Related: `GET /api/admin/absensi` reads a `search` query param
(`route.ts:32`) and never uses it, so the client-side search box
(`absensi-client.tsx:55` builds the params) silently has no server effect.

### D6 — `PUT /api/admin/absensi` is unvalidated mass assignment

`route.ts:149-158`:

```ts
const { id, ...updates } = await request.json()
supabase.from('absensis').update(updates).eq('id', id)
```

Every key in the body except `id` is written straight to the row, so a caller can
overwrite `user_id`, `nama`, `waktu`, `foto`, or `unit` — not just the field
being inline-edited. There is no allow-list. Compounding this, the client calls
`PUT /api/admin/absensi/${id}` (`absensi-client.tsx:231`) while the `[id]` route
exports only `DELETE`, so inline editing returns 405 today; the mass-assignment
path is reachable via `PUT /api/admin/absensi` directly.

### D7 — `absensis.value` is never set on check-in → rekap waktu under-reports

`POST /api/absensi` inserts `user_id, nama, unit, lokasi, alamat, foto, waktu`
only. `value` (`CHAR(1) CHECK IN ('S','I','A')`, nullable) is left `NULL`, and
`akurasi` likewise, despite both being in the CSV header list
(`export/route.ts:48`, `export-lokasi/route.ts:54`).

`GET /api/export/export-waktu` then computes `const value = record?.value || 'A'`
(`route.ts:86`) — so a genuine, GPS-verified, photo-backed check-in is scored as
**Absent** in the payroll recap CSV, and contributes 0 to the total. Only
`POST /api/export/backup-save` ever writes a non-null `value`. This is the
highest-impact data-correctness issue in the folder.

The same handler is also `O(teachers × days)`: `absensis.find(...)` inside a
double loop (`route.ts:83`), over an unbounded
`.select('*')` for the whole period — quadratic and unpaginated.

### D8 — CSV is built by naive `join(',')`

`export/route.ts:59`, `export-lokasi/route.ts:65` and
`export-waktu/route.ts:97` all do `rows.map(r => r.join(',')).join('\n')` with no
RFC 4180 quoting. `alamat` (reverse-geocoded street addresses) and `Nama Guru`
frequently contain commas, which silently shifts every subsequent column in
Excel. Values containing `"` or newlines are likewise unescaped.

### D9 — Public URLs against a private bucket

`POST /api/absensi` stores `supabase.storage.from('uploads').getPublicUrl(fileName).publicUrl`
in `absensis.foto`, but `supabase/schema.sql:306` documents the `uploads` bucket
as `Public: false (use signed URLs)`. If the bucket is in fact private, every
stored photo URL 404s and `GET /api/export?type=zip` (which does
`await fetch(absen.foto)` server-side, `export/route.ts:88`) silently logs
`Failed to fetch image` for each row and emits a near-empty `uploads.zip`.

### D10 — Timezone-naive day boundaries

`POST /api/absensi` builds "today" with `new Date(new Date().setHours(0,0,0,0))`
and compares against `absensis.waktu` (`timestamptz`) after `.toISOString()`
conversion (`route.ts:65-66`), and the WhatsApp date/time strings use the server's
local timezone while `waktu` is stored as UTC. `backup-save` has the same issue
(`export/backup-save/route.ts:54-55`). If the server does not run in
Asia/Jakarta, the duplicate-check window and the day bucketing are off by hours.
Note also `.lt('waktu', …23:59:59.999)` is an exclusive bound, so a record
timestamped in the final millisecond of the day slips past the 409 guard.

### D11 — Hardcoded default password

`schedule/import/route.ts:218,223` sets every teacher account's password to the
literal `'abbs2024'` — including *resetting* the password of existing teachers on
every import run (`auth.admin.updateUserById(existingUser.id, {password:'abbs2024'})`).
Re-running an import silently reverts any teacher password change back to a
publicly-known value.

### D12 — Destructive prune pass on import

Both `admin/import-teachers/route.ts:338-354` and
`schedule/import/route.ts:248-263` delete any non-admin `profiles` row whose auth
email is absent from the uploaded file — and `schedule/import` does so *after*
having wiped the entire `schedules` table. The prune is gated on
`importedEmails.length > 0`, but that list is built from rows that may all have
failed `auth.admin.createUser` (`continue` on error, `route.ts:227-230`), so a
partially-failed import can delete every teacher it failed to import. There is no
dry-run, no confirmation token, and no dry-run equivalent of the `confirm='on'`
flag that `schedule/import` does check.

### D13 — Missing self/last-admin guards

`PUT /api/admin/teachers/[id]/remove-admin` accepts any `id`, including the
caller's own, with no body and no confirmation — an admin can demote themselves
and, if they are the only admin, lock everyone out of `/admin`,
`/explorer`, `/export` and `/backup` (all admin-gated in `middleware.ts:64-87`).
`DELETE /api/admin/teachers/[id]` has the same problem and additionally leaves
`schedules.teacher` as a dangling free-text name rather than cascading.

### D14 — Shared `uploads` namespace, no path sanitisation

The file explorer and attendance photos share one flat bucket. `POST
/api/explorer/upload` accepts a client-supplied `path` and interpolates it
unsanitised into `` `${path}/${file.name}` `` with `upsert: true`, so a crafted
`path` could target an existing attendance-photo object and overwrite it;
`DELETE /api/explorer/delete-file` will likewise delete one. `newFolder` and
`newName` are regex-validated, but `path` is not. `explorer/delete-folder` is
non-recursive, so nested folders survive a "delete folder"; and
`explorer/rename` is download→upload→remove, so a failure between the last two
steps leaves two copies (the `remove` error is only `console.error`'d).

### D15 — Structural issues

- **No shared guard helper.** The 12-line auth+admin block is duplicated into
  ~25 handlers with no `withAuth()` wrapper, which is exactly why D0 exists.
  `public.is_admin()` is unused.
- **Silent catch blocks.** Nearly every handler's `catch` discards the error
  object entirely, so 500s carry no diagnostic information; only four handlers
  log first.
- **Untyped request bodies.** Handlers destructure into untyped locals and build
  `Record<string, unknown>` (e.g. `admin/teachers/[id]/route.ts:81`) rather than
  using the interfaces in `src/types/index.ts`.
- **`PUT /api/admin/teachers/[id]` partial-failure ordering.** It commits the
  `profiles` update first, then the auth email change (error merely logged), then
  the auth password change (error → 500) — three independent writes with no
  transaction, so a 500 can leave name/phone persisted and password unchanged.
- **`GET /api/schedule` uses the middleware client** (`@/utils/supabase/middleware`)
  while every sibling handler uses `@/utils/supabase/server`. It happens to work
  because `setAll` writes onto an unused `NextResponse`, but it is a fourth
  construction idiom for no benefit and makes the handler's session handling
  depend on `request.cookies` rather than `next/headers`.
- **Non-JSON response from a JSON API.** `POST /api/auth/logout` returns a 302
  redirect to `/login` rather than `{success:true}`; every other handler in the
  folder returns JSON. It works only by accident: `fetch()` transparently
  follows the redirect and lands on the 200 HTML login page, so
  `app-shell.tsx:88`'s `if (response.ok)` is satisfied. Any caller that tried
  to `response.json()` on it would throw, and `router.push('/login')` is
  redundant with the redirect the server already issued.
