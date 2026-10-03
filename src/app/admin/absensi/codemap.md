# src/app/admin/absensi/

"Backup Absensi" — admin view over teacher attendance in `absensis`: filters, four summary tiles, a
31-day-per-teacher completeness grid, an inline-editable detail table, and three destructive delete
paths with an optional purge of the storage photos. `page.tsx` (RSC, 65 lines) renders `PageHeader`
(title, `crumbs` Beranda → Admin → Absensi, `description`) plus `AbsensiClient`, which holds all of
the logic (`'use client'`, 893 lines).

## Purpose

Guard the route (`profiles.is_admin`), seed the client with the non-admin teacher list and the
distinct `year` / `month` values in `absensis`, and show per teacher per day-of-month how complete a
check-in is — correctable in place, deletable as a record, a period, or everything.

## Entry points

`page.tsx` is an `async` Server Component with no `'use client'`: the module-standard guard
(`cookies()` → `createClient` → `auth.getUser()` → `/login` → `profiles.select('is_admin')` →
`/unauthorized`, page.tsx:13-32), exactly two reads (page.tsx:35-48), then the two children. Props
(absensi-client.tsx:52-56): `{ teachers: Teacher[]; years: number[]; months: number[] }` with
`Teacher {id, name}`, and `MONTH_NAMES` (absensi-client.tsx:58-61) as the Indonesian month
vocabulary behind the `<option>` labels and the period-delete confirmation. **RSC / client
boundary:** every fetch, edit and delete is client-side, and the server page only authenticates and
seeds props.

## Auth and data flow

`page.tsx` reads `profiles` (`is_admin` for the guard, then `id, name` where `is_admin = false` for
the teacher rows) and `absensis` (`year, month`, ordered descending) from a cookie-bound Supabase
client, then hands the derived `years` / `months` down as props. `AbsensiClient` calls five
admin-gated handlers under `src/app/api/admin/absensi/`: `GET ?year&month` into `absensiData`,
`DELETE /{id}`, `PUT /{id}` with `{waktu|lokasi}`, `POST delete-all?with_image=0|1`, and
`POST delete-by-period` with `{month, year, with_image}`. All four re-verify `getUser()` +
`profiles.is_admin` (401 / 403) first. One `useEffect` keyed on `[selectedYear, selectedMonth]`
(absensi-client.tsx:126-153) builds the query string; `searchQuery` and `dataType` are pure
client-side `useMemo` filters (absensi-client.tsx:156-181), as is the `summary` rollup behind the
tiles. `GET` orders `waktu desc` and caps at `limit=100` (api/admin/absensi/route.ts:33-40), so only
the newest 100 rows are ever visible. Mutations patch local state only; no `router.refresh()`.

## Component structure

- `StatCard` × 4 (absensi-client.tsx:332-365): "Total Record" (info), "Guru Tercatat" (accent),
  "Record Berfoto" (success), "Tanpa Lokasi" (danger vs neutral, driven by
  `summary.withoutLocation > 0`); each `value` is a `<Skeleton>` while `loading`.
- `Card` + `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` — five shells: filters,
  delete-by-period, delete-all, "Rekap Per Guru", "Detail Absensi". The filter card
  (absensi-client.tsx:378-435) holds four `Field`s: `Tahun`, `Bulan`, `Tipe Data`, `Cari`. `Field`
  is a render-prop wrapper owning the label, the hint, and the `id` / `aria-describedby` /
  `aria-invalid` props it spreads onto the child, so a control reads
  `<Field>{(field) => <Select {...field} …/>}</Field>`.
- Grid — `TableScroll label="Rekap absensi per guru" maxHeight="26rem"` around a CSS grid with 31
  day columns (absensi-client.tsx:526-605): sticky `Guru / Tanggal` column, one row per teacher, a
  legend `<ul>` spelling out all five fills. Per teacher the records collapse into a
  `Map<day-of-month, AbsensiRecord>` (absensi-client.tsx:553-559), so a teacher occupies at most one
  cell per day — a "did they check in" heatmap, not a date grid. Fills come from `CELL_LOOKUP` /
  `resolveState` (absensi-client.tsx:70-105): complete (time + location + photo), time-location,
  time, location, photo, empty. Every cell carries a `title`, so colour is never the only channel.
- Detail table — `TableScroll label="Detail absensi"` → `Table min-w-[900px]` with `TableCaption`,
  `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell`; columns Guru · Nilai · Waktu
  · Lokasi · Alamat · Foto · Aksi, skeleton rows while loading, `EmptyState` in a `colSpan={7}` cell
  when empty, no pagination. `PhotoCell` (absensi-client.tsx:856-893) falls back to a dashed
  `CameraOff` placeholder when the file is missing or its URL 404s.
- `FeedbackBanner tone={message.type} onDismiss={…}` replaces the old inline alert div
  (absensi-client.tsx:325-329): errors announce as `role="alert"`, successes as `role="status"`.

## The S / I / A student-status Badge

`SIA_LABELS` (absensi-client.tsx:63-68) maps the `absensis.value` `CHAR(1)` column
(`CHECK (value IN ('S','I','A'))`, supabase/schema.sql:50) to a word plus a `Badge` variant: S →
"Sakit" / `warning`, I → "Izin" / `info`, A → "Alpa" / `danger`. The cell
(absensi-client.tsx:668-677) renders the letter, sets `title={sia.word}` for the hover tooltip and
appends `<span className="sr-only"> — {sia.word}</span>`, so colour is never the first channel:
sighted users get the letter, everyone gets the spelled-out word.

## The two delete Dialogs

`Dialog` is built on the native `<dialog>` element, so focus trapping, page inertness and Escape
come from the platform; it replaced `window.confirm()` entirely. Three are mounted, all `size="sm"`,
each with a `Batal` / danger-button `footer`. **Delete by period** (absensi-client.tsx:781-802)
titles "Hapus absensi periode" and names the period from `periodMonth` / `periodYear`, derived from
the single `<Input type="date">`; `handleDeleteByPeriod` (absensi-client.tsx:243-277) uses only
`selectedPeriod.start.getMonth()+1` / `getFullYear()`, so although the field is labelled "Periode
(21st - 20th)" no 21st→20th rollover is implemented, and its trigger keeps a guard erroring "Pilih
periode terlebih dahulu" when no date is set (absensi-client.tsx:468-475). **Delete all**
(absensi-client.tsx:805-825) POSTs `delete-all?with_image=1|0` then `setAbsensiData([])`; a third
Dialog (absensi-client.tsx:750-778) covers one record.

**The photos checkbox defaults to UNCHECKED on purpose, not by accident.** `deleteImages` is
`useState(false)` (absensi-client.tsx:123) and is never reset when a dialog opens or closes. The old
flow was a *second* `confirm()` step — "Hapus juga foto yang tersimpan?" — that only ran once the
first confirm was already accepted, so deleting photos required an explicit second OK.
`ImageCheckbox` (absensi-client.tsx:831-849) replaces that prompt with one in-dialog control, and a
pre-ticked box would destroy every stored photo the moment the dialog opened. The same state backs
both dialogs, so a tick carries over between them.

## Gotchas — two deliberately preserved bugs

1. **Year/month filters and the period delete target columns that do not exist.** The filters read
   `absensis.year` / `absensis.month` (page.tsx:42-48), `GET` filters on `.eq('year')` /
   `.eq('month')` (api/admin/absensi/route.ts:42-48), and `delete-by-period` posts `{month, year}`.
   But `absensis` in supabase/schema.sql:40-53 has **no `year` and no `month` column** — only
   `attendances` does (supabase/schema.sql:61, index on `student_id, day, month, year`) — so both
   dropdowns are stuck on "Semua Tahun" / "Semua Bulan" and the period delete matches zero rows.
2. **Inline edit 405s.** `saveInlineEdit` PUTs to `/api/admin/absensi/{id}`
   (absensi-client.tsx:291-297), but `src/app/api/admin/absensi/[id]/route.ts` exports only
   `DELETE` (line 5). A collection `PUT` exists at api/admin/absensi/route.ts:126, but the client
   never targets it, so Next.js returns 405 and `FeedbackBanner` reports the failure — editing
   `waktu` and `lokasi` never persists. Only the transport is missing.

## Style contract

- Tokens are namespaced `--ds-*` in `src/app/globals.css` and reach the markup as Tailwind
  utilities (`bg-surface-sunken`, `text-text-tertiary`, `border-danger-border`); the helper classes
  used heavily here (`eyebrow`, `meta`, `prose-block`, `action-row`, `focus-ring`) live in the same
  file. Never raw hex. Icons are `lucide-react`; decorative ones carry `aria-hidden`.
- The legacy Bootstrap-parity and brutalist CSS layers **still exist** in that file, from
  `src/app/globals.css:369+` (closing SweetAlert2 `.swal2-popup.ny-popup` overrides) and
  `src/app/globals.css:1842+` (`/* Toasts */` and the brutalist card, button, table, grid, modal
  and badge rules, through the end of the file at :2826). They are **not** gone: the teacher pages
  under `src/app/(dashboard)/` — `/journal`, `/absensi`, `/schedule`, `/prevSmes`, `/export`,
  `/profile` — are not yet migrated and still depend on them. Do not delete that layer, and do not
  reuse its class names here.
- The markup described in earlier versions of this file (brutalist card / button / input / table /
  small-caps-label classes, and FontAwesome `<i>` icon elements) is now the primitives in
  `src/components/ui/`; `toast-provider` and SweetAlert2 are unused here.
