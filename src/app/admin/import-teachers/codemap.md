# src/app/admin/import-teachers/

Bulk teacher import from Excel. The admin picks an `.xlsx`/`.xls`; the client parses it in the
browser, auto-detects **Format A** (columns = subjects, cell = class) or **Format B** (columns =
class codes like `7A`, cell = subjects), previews the first 10 normalised rows, then posts the
file to `/api/admin/import-teachers`, which creates/updates Supabase Auth users plus the
`profiles` rows (including the `mapel` JSONB) and prunes teachers missing from the file.
Files: `page.tsx` (RSC, 49 lines), `teacher-import-form.tsx` (`'use client'`, 296 lines).

## Purpose

Guard the route (admin only), render the form, and show the admin what will be created (name,
email, password, phone, derived `mapel` list) before committing. The writes themselves belong to
the route handler, which repeats the auth gate.

## Entry Points

**`page.tsx` (RSC)** — `async` Server Component, no `'use client'`, no props, static `metadata`
(`:7-10`). Guard only (`:13-32`): `await cookies()` → `createClient(cookieStore)` →
`auth.getUser()` → `redirect('/login')` → `profiles.select('is_admin').single()` →
`redirect('/unauthorized')`. Renders `<PageHeader title="Import Guru" crumbs={Beranda → /, Admin
→ /admin, Import Guru} description="Unggah data guru beserta mapel dari berkas Excel. Format A
dan B dikenali otomatis." />` (`:36-44`) in a `flex flex-col gap-5` wrapper, then
`<TeacherImportForm />` (`:46`).

**`teacher-import-form.tsx` (Client)** — `'use client'` at line 1, default export, no props, no
sub-components, no modal. All state (`loading`, `message`, `preview`, `format`, `fileName`,
`file`) and `fileInputRef` live here (`:37-43`); icons are `FileSpreadsheet` and `Info`.
**RSC vs client boundary** — the page ships no data and no handlers; reading, parsing, detection,
preview and the POST are all client-side, so the server only guards.

## Auth and Data Flow

```
page.tsx (RSC guard) ──▶ <TeacherImportForm />
  └─ await import('xlsx') + file.arrayBuffer() ──▶ workbook.SheetNames[0] only
     ── detection (:133-136) ──▶ 'A' | 'B' | null ──▶ preview (≤10)
     ── POST /api/admin/import-teachers (multipart field 'file')
          ├─ repeats getUser() + profiles.is_admin → 401 / 403, then re-detects the format
          ├─ per row: auth.admin.listUsers() → updateUserById / createUser
          ├─ mapSubject() + flattenClasses() + normalizeMapel() (@/lib/subject-normalizer)
          ├─ profiles.upsert({ id, name, is_admin: false, phone_num, mapel })
          └─ prune non-admin profiles whose auth email is not in importedEmails
             → profiles.delete() + auth.admin.deleteUser()
     ◀── { imported: <count>, format: 'A' | 'B' | null }
```

`route.ts:221` reads `formData.get('file')`; a missing file is 400 ("File tidak ditemukan"), an
empty sheet 400 ("File Excel kosong").

## Two-State Upload Flow

**Idle** (`file === null`): a dashed `border-border-strong` target, `min-h-44` touch height,
accepting drop, click and Enter/Space, with "Seret file ke sini" and "klik untuk memilih · .xlsx
atau .xls" (`dropzone.tsx:132-184`); while dragging it turns `border-accent bg-accent-subtle` and
"Lepaskan untuk mengunggah". **Active** (`file !== null`): the target is replaced by a row with the
file icon, the name, the size from `formatSize()` (B / KB / MB, `dropzone.tsx:24-28`), the
uppercased extension, and an `X` button calling `onFileChange(null)` with `aria-label="Hapus file
{name}"` (`dropzone.tsx:101-131`). Hint below: "Format dikenali otomatis dari nama kolom. Hanya
sheet pertama yang dibaca." (`teacher-import-form.tsx:202`).

### CRITICAL: the real file input

`Dropzone` renders the actual `<input type="file" id name accept required disabled onChange>` with
`className="sr-only"` (`dropzone.tsx:88-99`). It is **inside the surrounding `<form>`**
(`teacher-import-form.tsx:181`) and is **never `display:none`, never `hidden`, never
conditionally unmounted** — it renders in both the idle and the active branch. That is what keeps
`new FormData(event.currentTarget).get('file')` (`teacher-import-form.tsx:52-53`) and the outgoing
`importFormData.append('file', submitted)` payload (`:63`) working. Hiding it with `display:none`,
unmounting it, or moving it out of the `<form>` silently breaks the import; `dropzone.tsx:98` is
the line that guarantees it. A `useEffect` also clears `input.current.value` whenever `file` is
falsy (`dropzone.tsx:73-75`), keeping the native value honest after a remove or a form reset.

## Format Detection and Banner

Client-side in `handleFileChange` (`teacher-import-form.tsx:133-136`): `hasRombel =
headers.some(h => /^[789][a-z]?$/i.test(h))`; `requiredA = ['math','ipa','ips','pkn','ict','pjok',
'indonesian','english','pai','quran']`; `matchCount` counts how many of those appear in the
lowercased, trimmed headers (`:123`); `detectedFormat = hasRombel ? 'B' : matchCount >= 2 ? 'A' :
null`. Rows without a `nama`/`name` value are dropped (`:130`). **Format B** (`:149-155`): every
column key matching `/^[789][a-z]?$/i` is a class column; its value is split on
`/\s*(?:&|\+|dan)\s*/i` and the parts become the subjects. **Format A** (`:156-164`): every key
outside `no, nama, name, email, password, number, num, hp, telepon, wa, whatsapp, phone` with a
non-empty, non-`'-'` string value contributes `key.replace(/_/g, ' ')`. When detected, a
`<FeedbackBanner tone="info">` (no dismiss) reads "Format terdeteksi: **Format A (Mapel sebagai
kolom)**" or "**Format B (Kelas sebagai kolom)**" (`:205-212`). Phone chain: `hp → telepon → wa →
whatsapp → phone → num → number` (`:144-146`).

## Preview Table

When `preview` is non-empty: a second `<Card>` titled "Preview (10 baris pertama)" with
"Pastikan nama, email, dan password sudah terisi sebelum melanjutkan." and a `FileSpreadsheet`
icon tile (`:228-287`). `<TableScroll label="Preview data guru">` wraps `<Table
className="min-w-[720px]">`; `TableCaption` is `sr-only` (`table.tsx:8-10`). Columns **Nama ·
Email · Password · Phone · Mapel**; the Mapel cell renders one `<Badge variant="neutral">` per
subject, or an `<Info>` icon with `-` in `text-text-disabled`. Rows keyed by index (`:258`).

## Submit and Button States

`<Button type="submit" size="lg" loading={loading} disabled={!file} loadingText="Mengimpor...">`
labelled "Import Guru" (`:289-293`). `Button` forces `disabled` while `loading`, sets `aria-busy`,
and swaps in a spinning `Loader2` plus `loadingText` (`button.tsx:72-83`). The single `loading`
flag covers both phases — client preview parsing (`:105`) and the import POST (`:47`) — and the
Dropzone is `disabled={loading}` (`:198`). On success `event.target.reset()` (`:82-84`) plus
`setFile(null)` returns the button to disabled, and the Dropzone effect clears the input.

## Feedback Mechanism

One `message` state `{ type: 'success' | 'error', text }` (`:38`) rendered as
`<FeedbackBanner tone={message.type} onDismiss={() => setMessage(null)}>` (`:220-224`);
`FeedbackBanner` announces errors with `role="alert"` and successes with `role="status"`, and only
renders the close button when `onDismiss` is given (`feedback-banner.tsx:44-62`). Success text:
"Import berhasil! {n} guru diimpor. Format: {format}"; server errors surface via `throw new
Error(data.error || 'Import gagal')` (`:72-79`). `fileName` is set on success and shown as
"Terakhir diimpor: {fileName}" (`:214-218`); it is never part of the payload.

## Gotchas

- The `sr-only` file input must stay mounted inside the `<form>` — see CRITICAL above.
- The banner reflects client detection; the success message mirrors the server's `data.format`.
- Only the first sheet is read (`:114`); an empty sheet errors "File Excel kosong" (`:117-121`).
- `handlePreview` is misnamed — it performs the import. Preview comes from `handleFileChange`.
- `preview` is not cleared after success, so the last preview stays on screen.
- `xlsx` is dynamically imported (`:111`) so the parser stays out of the initial bundle.

## Style Contract

Design tokens are namespaced `--ds-*` in `src/app/globals.css` (token block `:root` at `:19`,
`--ds-surface-*` etc. from `:23`), bridged to Tailwind utilities by the `@theme inline` block at
`:183`, with the shell base scoped to `[data-ds-shell]` (`:274`; the admin shell sets the
attribute at `src/components/admin/shell.tsx:137`). The old `.admin-shell` selector/class is gone.
The legacy Bootstrap-parity layer and the second legacy (brutalist) layer have also been **deleted**
— `globals.css` is 499 lines and ends with a removal note — so `.card-brutalist`, `.btn-brutalist`,
`.table-brutalist`, `.brutalist-select` and `.section-label` no longer exist. This route uses only
design-system utilities plus `.meta` (`:320`, also `[data-ds-shell]`-scoped) for the "Terakhir
diimpor" line.
Components used, all from `@/components/ui/*`: `PageHeader`, `Card` family, `Dropzone`,
`FeedbackBanner`, `Table` family (`TableScroll`, `TableCaption`, `TableHeader`, `TableBody`,
`TableRow`, `TableHead`, `TableCell`), `Badge`, `Button`.
