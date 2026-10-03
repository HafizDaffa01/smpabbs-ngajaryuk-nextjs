# src/app/schedule/import/

## Responsibility

Admin-only bulk importer that loads a school's **aSc Timetables v9.4 workbook** (`v9.4.xlsx`) into the database. The import is destructive: it rewrites the whole `schedules` table *and* synchronises the `profiles` + Supabase Auth teacher accounts derived from the workbook. The page is a thin admin gate; all the work happens in two API routes backed by dedicated parsers.

| File | Kind | Lines | Location |
|---|---|---|---|
| `page.tsx` | Async Server Component | 56 | `src/app/schedule/import/page.tsx` |
| `import-form.tsx` | Client Component (`'use client'`) | 197 | `src/app/schedule/import-form.tsx` (**parent `schedule/` dir**, imported as `../import-form`) |

Note the file placement: `import-form.tsx` sits in `src/app/schedule/`, not inside `import/`. Because it lives outside the `import/` segment it is still routed as `/schedule/import-form` if it had a `page.tsx`, but it has none — it is only ever imported, so this is safe but unconventional.

## Design

### `page.tsx` — admin gate

1. `cookies()` → `createClient(cookieStore)` → `auth.getUser()` → `redirect('/login')`.
2. `profiles.select('is_admin').eq('id', user.id).single()` → `if (!profile?.is_admin) redirect('/unauthorized')`.
3. Renders `main.container.pb-5`, a back link `<a href="/schedule" className="text-primary-bold">← Kembali ke Jadwal</a>`, and a `.card-brutalist` whose header shows `.section-label` `IMPORT_JADWAL` + `<h2 class="h4 mb-0">Import Jadwal dari aSc Timetables</h2>`. Body mounts `<ScheduleImportForm />`.

> **Duplicated chrome.** `page.tsx` renders a `.card-brutalist` with the exact same `IMPORT_JADWAL` label and `Import Jadwal dari aSc Timetables` heading that `ScheduleImportForm` renders on its own root `.card-brutalist` (lines 102–107). The user sees a card-inside-a-card with a repeated header.

### `import-form.tsx` — two-phase upload with preview

State: `loading`, `message: { type: 'success'|'error'; text } | null`, `preview: Record<string, string[][]> | null`, `showConfirm`. Ref: `fileInputRef`.

**Phase 1 — `handlePreview(event)` (bound to the form's `onSubmit`):**

1. `const formData = new FormData(event.currentTarget)`; `const file = formData.get('file_v94') as File`.
2. Missing file → `setMessage({ type: 'error', text: 'Pilih file Excel terlebih dahulu' })`.
3. Builds a **fresh** `FormData` with just `file_v94` and `POST /api/schedule/preview`.
4. On `!response.ok` it throws with `data.message || 'Gagal membaca file'` — note it reads `data.message` (the preview route's error shape), unlike the import route which returns `error`.
5. On success: `setPreview(data); setShowConfirm(true)`.

**Phase 2 — `handleImport()` (bound to the "Konfirmasi Import" button):**

1. `if (!preview) return`.
2. Re-reads the file from the DOM — `const file = fileInputRef.current?.files?.[0]` — because the `File` object was never kept in state. Missing → `'File tidak ditemukan'`.
3. `formData.append('file_v94', file)` and `formData.append('confirm', 'on')`, then `POST /api/schedule/import`.
4. On `!response.ok` throws `data.error || 'Import gagal'`.
5. On success: success message from `data.message`, `setShowConfirm(false)`, `setPreview(null)`, and `fileInputRef.current.value = ''` to clear the file input.

**UI:** intro paragraph — *"Upload file v9.4.xlsx dari aSc Timetables. File akan di-parse dan diimport ke database."* A `<input type="file" accept=".xlsx,.xls" required>` with label `File Excel (v9.4.xlsx)`. The "Preview File" button (`.btn-brutalist`) is rendered **only when `!showConfirm`**, so after the preview the only forward path is the confirm button — there is no way to change the file without reloading the page or cancelling.

**Preview rendering** (only when `showConfirm && preview`): a nested `.card-brutalist` headed `Preview Import`, showing `Sheets found: {preview.sheetNames?.length || 0}` and then, for each `Object.entries(preview.sheets)`, the sheet name plus a raw `<pre className="… bg-body-tertiary p-2 …" style={{ fontSize: '0.75rem', borderRadius: 0 }}>{JSON.stringify(rows, null, 2)}</pre>`. This is a **JSON dump, not a table** — the design spec §4.4 asked for a `.table-brutalist` results table, so this deviates from the spec. Two buttons follow: `.btn-brutalist-success` "Konfirmasi Import" and `.btn-brutalist-outline` "Batal" (which resets `showConfirm`/`preview` but not the file input).

## Data Flow

### `POST /api/schedule/preview` (`src/app/api/schedule/preview/route.ts`)

- Auth: `auth.getUser()` → **401**. **No admin check** — any authenticated user can preview a workbook.
- `request.formData()` → `formData.get('file_v94')`; missing → **400** `{ error: 'File tidak ditemukan' }`.
- `const xlsx = await import('xlsx')` (dynamic, keeps it out of the server bundle); `xlsx.read(await file.arrayBuffer(), { type: 'buffer' })`.
- For **every** sheet in `workbook.SheetNames`, samples at most **5 rows × 8 columns**, deriving dimensions from `sheet['!row'].length` / `sheet['!col'].length` and addressing cells with `sheet[\`${String.fromCharCode(64 + c)}${r}\`]` — i.e. columns A–H only, single-letter addressing. Empty cells become `''`.
- Returns `{ status: 'success', sheets: <name → string[][]>, sheetNames }`. Catch → **500** `{ status: 'error', message: 'Gagal membaca file' }` (the `status` + `message` shape is why the client reads `data.message`). `GET()` → **405**.

### `POST /api/schedule/import` (`src/app/api/schedule/import/route.ts`) — the destructive path

1. Auth: **401** if unauthenticated; **403** if `!profiles.is_admin`.
2. `formData.get('file_v94')` missing → **400** `'File tidak ditemukan'`; `confirm !== 'on'` → **400** `'Konfirmasi import diperlukan'` (this is the server-side half of the preview→confirm handshake).
3. Reads the workbook, then **step 1 — reference data**:
   - `readClassesSheet(workbook)` → `allClasses: string[]`
   - `readTeachersSheet(workbook)` → `nicknameMap` (`NicknameMap`: `nicknameToFullname`, `nicknameToClassesSubjects`)
   - `readLessonsSheet(workbook, nicknameMap)` → `lessonsResult` (`LessonsResult`: `teacherMap`, `teacherToClassesSubjects`, `teacherNickToClassesSubjects`, `leadershipParticipants`)
4. **Step 2 — teacher import** via `importTeachersFromV94(workbook, lessonsResult.teacherMap, supabase, xlsx)`.
5. **Step 3 — wipe the schedule table:** `supabase.from('schedules').delete().neq('id', 0)` — deletes every row (the `.neq('id', 0)` is only there to satisfy RLS semantics). Failure is logged with `console.error('Delete schedules error:', …)` but **does not abort** — the import continues, so a failed delete silently produces a merged (duplicated-key) table that the later `upsert` may partially resolve.
6. **Step 4 — format detection:** `hasAvailableTeachersFormat(workbook)` → if true, `processAvailableTeachersFormat(workbook, allClasses, teacherToClassesSubjects, teacherNickToClassesSubjects, nicknameToFullname)`; otherwise loop `SUBJECT_SHEETS` (`'Sprt.', 'Soc.', 'Sc.', 'Quran.', 'Math.', 'IFE.', 'ICT.', 'Eng.', 'Cv.', 'BI.'`) calling `processSubjectSheet(sheet, teacherMap, allClasses)` for sheets that exist.
7. **Step 5 — Leadership sheets:** loop `LEADERSHIP_SHEETS` (`'LEADERSHIP 7.'`, `'LEADERSHIP 8.'`, `'LEASDERSHIP 9.'` — the typo is in the source), look up the code via `LEADERSHIP_CODE_OF_SHEET` (`L7`/`L8`/`L9`), fetch `lessonsResult.leadershipParticipants.get(code)`, then `processLeadershipSheet(sheet, participants, code)`.
8. **Step 6 — no-teacher sheets:** loop `WITHOUT_TEACHER_SHEETS` (`'HOMEROOM TEACHER.'`, `'SCOUT.'`, `'SENI BUDAYA KESENIAN.'`, `'SELF DEVELOPMENT.'`) → `processWithoutTeacherSheet(sheet, allClasses)`.
9. **Step 7 — batch write:** `supabase.from('schedules').upsert(allRecords, { onConflict: 'class_name,day,period' })` — one bulk statement. Error → **500** `'Gagal menyimpan jadwal: …'`.
10. `imported === 0` → **400** `'Tidak ada data jadwal yang berhasil diimport. Pastikan file v9.4.xlsx sesuai format yang diharapkan.'`
11. Success → `{ success: true, message: \`Berhasil import ${totalTeachers} guru & ${imported} slot jadwal dari v9.4.xlsx.\`, teachers, schedules }`. That message is what the form surfaces.

### `importTeachersFromV94()` — side effects worth flagging

- Reads the **`Teachers`** sheet with `xlsx.utils.sheet_to_json(sheet, { header: 1 })`; `name = rows[i][1]`, `short = rows[i][2]`; **breaks on the first blank name** (implicit end-of-data detection).
- Builds `nicknameToMapel` from `teacherMap` keys split on `'|'` into `[kelas, mapel]`.
- `generateEmailFromName(name)` per teacher.
- `supabase.auth.admin.listUsers()` is called **inside the per-teacher loop** (line 210) to look for an existing account — a full user listing per teacher, i.e. O(n) full scans.
- **Existing user** → `auth.admin.updateUserById(id, { password: 'abbs2024' })`.
- **New user** → `auth.admin.createUser({ email, password: 'abbs2024', email_confirm: true })`.
- Either way `profiles.upsert({ id: userId, name, is_admin: false, mapel: normalizeMapel(mapelData) })`.
- **Pruning:** after the loop, it lists all `profiles.select('id').eq('is_admin', false)`, calls `auth.admin.getUserById(p.id)` for each, and **deletes the profile and the auth user** when the email is not in `importedEmails`. Teachers who left the workbook therefore lose their accounts entirely.
- Net effect: running this import **resets every teacher's password to the hard-coded literal `abbs2024`** and deletes non-admin accounts absent from the workbook. There is no dry-run and no undo.

## Integration Points

- **Domain libraries:**
  - `@/lib/v94-parser` — `readClassesSheet`, `readTeachersSheet`, `readLessonsSheet`, `processSubjectSheet`, `processLeadershipSheet`, `processWithoutTeacherSheet`, `processAvailableTeachersFormat`, `hasAvailableTeachersFormat`, `generateEmailFromName`, plus `LessonsResult` / `NicknameMap`.
  - `@/lib/bell-schedule` — `SUBJECT_SHEETS`, `LEADERSHIP_SHEETS`, `LEADERSHIP_CODE_OF_SHEET`, `WITHOUT_TEACHER_SHEETS`, `type ScheduleRecord`. This module also owns the bell times and `getBellTimes(day, period, gender)` used to fill `start_time`/`end_time` on the produced records.
  - `@/lib/subject-normalizer` — `normalizeMapel(mapelData)` turns the raw `{ mapel, kelas }[]` pairs into the canonical `{ grade: subject }` jsonb shape stored in `profiles.mapel`, using `SUBJECT_MAPPING`/`normalizeSubject`.
- **Third-party:** `xlsx` (SheetJS), dynamically imported in both routes.
- **Tables:** `schedules` (rewritten wholesale), `profiles` (upserted + pruned), and `auth.users` via `supabase.auth.admin.*` (created / password-reset / deleted).
- **Auth:** double-gated — page-level `is_admin` → `/unauthorized`, and the same check inside `/api/schedule/import`. `/api/schedule/preview` only requires authentication.
- **Middleware:** `/schedule` is not in `protectedRoutes`, so this page's own `auth.getUser()` + `is_admin` check is the only edge-visible gate for `/schedule/import`.
- **Sibling writer:** `/api/schedule` `POST` and `/api/schedule/[id]` (used by `/admin/tsmanager`) are the non-bulk alternatives.
- **Read-back:** `/schedule` (the sibling page) reads whatever this import wrote; `src/app/journal/page.tsx`, `src/app/prevSmes/page.tsx`, `src/app/journal/show/page.tsx` and `src/app/prevSmes/show/page.tsx` all derive classes/subjects/rosters from it.