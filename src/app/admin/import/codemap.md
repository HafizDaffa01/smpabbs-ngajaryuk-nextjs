# src/app/admin/import/

Bulk student import from Excel: pick an `.xlsx`/`.xls` file via the design-system
`Dropzone`, preview the first 10 rows parsed **in the browser**, then upload the untouched
workbook to `POST /api/import-students`, which upserts `students (name, grade)`.

Files: `page.tsx` (Server Component, 49 lines), `import-form.tsx` (`'use client'`, 239 lines),
`codemap.md`.

## Purpose

- Guard the route (admin only) and render the page header plus the import form.
- Parse the workbook **in the browser** with a dynamic `import('xlsx')` and show a 10-row
  preview so the admin can sanity-check column mapping before uploading.
- Ship the raw file as multipart `FormData` and report how many rows were imported.

## Entry points

**`page.tsx`** — `async` Server Component, no `'use client'`, performs **no data query other
than the guard** (`await cookies()` → `createClient(cookieStore)` → `auth.getUser()` →
`redirect('/login')` → `profiles.select('is_admin').single()` → `redirect('/unauthorized')`).
It renders `<PageHeader title="Import Siswa" crumbs={[Beranda → /, Admin → /admin, Import
Siswa]} description="Unggah data siswa dari berkas Excel. Satu baris = satu siswa, kolom
pertama nama dan kolom kedua kelas." />` then `<ImportForm />` (imported as `ImportForm`,
exported as `ImportStudentsForm`) inside `flex flex-col gap-5`. `metadata` = "Import Siswa -
NgajarYuk" / "Import data siswa dari Excel". No back-link button; the breadcrumb covers it.

**`import-form.tsx`** — the only client component; no sub-components, no modal, no pagination.
State (5 × `useState` + 1 ref): `loading: boolean`,
`message: { type: 'success' | 'error'; text: string } | null`,
`preview: PreviewRow[] | null` (`PreviewRow = { name: string; grade: string; sheet: string }`),
`sheets: string[]`, `selectedSheet: string`, and `fileInputRef = useRef<HTMLInputElement>(null)`
passed into the `Dropzone` so the native input can be reset after a successful import.

## Auth / data flow

```
page.tsx  ── guard only (profiles.is_admin) ──▶ <ImportForm />
import-form ── arrayBuffer() + await import('xlsx') ──▶ xlsx.read({ type:'buffer' })
            ── sheet_to_json(sheet0, {header:1}) ──▶ preview (≤10 rows, client only)
            ── POST /api/import-students (multipart field: file) ──▶ src/app/api/import-students/route.ts
                 every sheet → row[0]=name, row[1]=grade, skip 'nama'/'name'
                 → students.upsert({name, grade: grade.toUpperCase()}, {onConflict:'name,grade'})
                 → { success, imported, errors? }
```

The preview is **purely cosmetic** — the upload always resends the original file, so the server does the authoritative parsing of all sheets. The route authenticates with `auth.getUser()` but, unlike the `/api/admin/*` handlers, does **not** check `is_admin`; access control comes from the page-level guard plus `middleware.ts`.

## Two-state upload flow

`<Dropzone>` (`src/components/ui/dropzone.tsx`) is controlled by the `file` prop and switches between two mutually exclusive branches:

- **Idle (`file === null`)** — a `role="button"`, `tabIndex={0}`, `min-h-44` dashed target with the `UploadCloud` icon, "Seret file ke sini" (or "Lepaskan untuk mengunggah" while dragging) and "atau klik untuk memilih · .xlsx atau .xls". It accepts **drag-and-drop** (`onDrop` → `dataTransfer.files?.[0]`) and **click / Enter / Space** → `input.current?.click()`. Disabled drops `tabIndex` to `-1`, sets `aria-disabled`, and mutes the target.
- **Active (`file !== null`)** — an accent-subtle row showing the truncated filename (`title={file.name}`), the size from `formatSize()` (B / KB / MB) plus the uppercased extension, and a `type="button"` remove action calling `onFileChange(null)` with `aria-label={`Hapus file ${file.name}`}`. The remove button never submits the form.

`handleFileChange(nextFile: File | null)` sets `file`; a `null` (remove) clears `preview` and `sheets` and returns early. Otherwise it clears the message, parses the file, stores `workbook.SheetNames` in `sheets` and defaults `selectedSheet` to `sheetNames[0]`. It parses **only the first sheet**: `xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })`, drops row 0 (`jsonData.slice(1)`), maps the first 10 rows positionally (`name = row[0]`, `grade = row[1]`, `sheet = sheetNames[0]`, each `String(…).trim()`) and `.filter(r => r.name)`.

### CRITICAL: the real `<input type="file" name="file">` stays in the DOM

`Dropzone` renders the actual input at `src/components/ui/dropzone.tsx:88-99` with
`className="sr-only"` — **visually hidden, never `display:none`, never unmounted** — inside
the surrounding `<form>`. That is why `new FormData(event.currentTarget).get('file')`
(`import-form.tsx:95-96`) still returns the chosen `File` and the multipart upload keeps
working. Do not swap that input for a purely visual button, do not apply `hidden` /
`display:none`, and do not move it outside the `<form>`. An effect in `Dropzone` clears
`input.current.value` whenever `file` is null, keeping `formData.get(name)` honest after a
remove or a reset.

## Preview table

Shown only when `preview && preview.length > 0`, as a second `Card` whose header holds `CardTitle` "Preview (10 baris pertama)", a description, and a decorative `FileSpreadsheet` badge. The body is `TableScroll label="Preview data siswa"` wrapping `Table className="min-w-[520px]"` with an `sr-only` `TableCaption`, columns **Nama · Kelas · Sheet**; rows keyed by index, name cell `font-semibold text-text-primary`, sheet cell uses the `meta` utility.

## Submit button states

`<Button type="submit" size="lg" loading={loading} disabled={!file} loadingText="Mengimpor...">` inside `flex justify-end`. `Button` disables on `disabled || loading`, sets `aria-busy` while loading, and swaps the label for a spinning `Loader2` plus `loadingText` ("Mengimpor..." instead of "Import Siswa"). The same `loading` flag gates the `Dropzone`, so parsing and submitting cannot overlap.

## Feedback mechanism

No SweetAlert2 and no `useToast()`. Results render inline as a `FeedbackBanner` in
`CardContent` below the `Dropzone`, with `tone={message.type}` and an `onDismiss` that clears
the message; the banner uses `role="alert"` for errors and `role="status"` for successes.
Success text is `Import berhasil! ${data.imported ?? 0} siswa diimpor.`; guards use "Pilih
file Excel terlebih dahulu", "Import gagal", "Gagal memuat preview", "Terjadi kesalahan".
No skeletons and no `EmptyState` here.

## Gotchas

- **Sheet selector caveat.** The `Field id="sheet"` + `Select` block renders only when `sheets.length > 1` and its hint says "Hanya sheet pertama yang dipratinjau", but `selectedSheet` is never read elsewhere — parsing always uses `SheetNames[0]` and submit sends the untouched file. Changing the dropdown does not re-parse or change the preview.
- **Two supported Excel format layouts.** The client preview is positional and header-blind: column A = name, column B = grade, row 0 dropped unconditionally, blank names filtered. The server is more forgiving: it iterates **every** sheet, requires both name and grade to be non-empty, and skips rows whose name lowercases to `nama` or `name`, so a workbook whose first row is real data still imports. `grade` is uppercased before the upsert.
- **`progul` is never populated**, even though the `students` table has the column.
- **One `loading` flag** is shared by `handleFileChange` (parsing) and `handleSubmit`.
- **On success** the form clears `fileInputRef.current.value`, `file` and `preview` (but not `sheets`), returning to the idle dropzone state.

## Style contract

- Tokens are namespaced `--ds-*` in `src/app/globals.css`, consumed through semantic utilities: `bg-surface-card`, `text-text-primary`, `border-border-subtle`, `bg-accent-subtle`, `text-accent-text`, plus the `meta`, `eyebrow`, `prose-block` and `focus-ring` classes.
- Icons are `lucide-react` (`UploadCloud`, `X`, `FileSpreadsheet`, `ChevronRight`, `Loader2`, `AlertCircle`, `CheckCircle2`, `ChevronDown`); decorative ones carry `aria-hidden`. Layout uses plain flex/grid utilities only; no custom CSS for this route.
- **The legacy layers are still here.** `globals.css:369+` holds the hand-written Bootstrap-parity CSS and `globals.css:1843+` the original brutalist brand layer (header comment at 1945). They remain because the TEACHER pages `/journal`, `/absensi`, `/schedule`, `/prevSmes`, `/export`, `/profile` are **not** migrated yet. The new system is strictly additive — do not claim the legacy layer is gone, do not reuse its class names.
- Related: `../import-teachers` is the teacher-side twin with richer format detection and `mapel` normalisation; both are reachable from the admin dashboard action cards.
