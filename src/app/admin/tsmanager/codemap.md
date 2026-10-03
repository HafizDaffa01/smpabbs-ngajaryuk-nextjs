# src/app/admin/tsmanager/

"TS Manager" — the full teacher-management screen: every `profiles` row (admins and teachers),
search + mapel-assignment filtering, inline editing of name/email/phone, role promotion/demotion,
delete, and a `mapel` (subject-per-class) JSONB editor dialog. Files: `page.tsx` (Server
Component, 56 lines), `ts-manager-client.tsx` (`'use client'`, 911 lines), `codemap.md`.

## Purpose

Guard the route, then hand **every** profile (not just non-admins) to the client table so admins
can be demoted. Keep the list in local state: mutations patch state, never reload — the only
admin teacher screen avoiding `window.location.reload()`. Let an admin rewrite a teacher's `mapel`
JSONB object (`{ "Kelas": ["Mapel1", …] }`) via structured rows or raw JSON.

## Entry points

**`page.tsx`** — `async` Server Component, no `'use client'`. `metadata` = "TS Manager -
NgajarYuk" / "Manajemen lengkap guru" (page.tsx:7). Renders `<PageHeader>` (page.tsx:43) with
crumbs Beranda → Admin → TS Manager, then `<TsManagerClient teachers={teachers ?? []} />`
(page.tsx:53) inside `flex flex-col gap-5`.

**`ts-manager-client.tsx`** — default export `TsManagerClient({ teachers })` (line 72); that prop
is the only input, so the server render is the source of truth. Two local components:
`MapelDialog` (line 606) and `AddTeacherForm` (line 824). **State (10 × `useState`)**:
`teachers: Teacher[]` seeded from the prop (line 73), `loading` (the busy row id),
`message: {type,text} | null`, `showAddForm`, `editingTeacher`, `editingMapel`, `mapelJson`,
`searchQuery`, `mapelFilter` (`'all' | 'assigned' | 'unassigned'`), `deletingTeacher`. There is
no `useEffect` in this file — the list never refetches.

## Auth and data flow

`page.tsx` guard (lines 12-32): `cookies()` → `createClient(cookieStore)` → `auth.getUser()` →
`redirect('/login')` → `profiles.select('is_admin').eq('id', user.id).single()` →
`redirect('/unauthorized')` when falsy. Then one read (page.tsx:35):
`supabase.from('profiles').select('*').order('is_admin', {ascending:false}).order('name')`.

```
page.tsx ──cookie client──▶ profiles.select('*')  (admins included, is_admin desc)
 └──props──▶ TsManagerClient { teachers } → useState copy
   PUT    /api/admin/teachers/${id}               handleUpdateTeacher (strips empty password)
   PUT    .../${id}/make-admin | remove-admin     handleMakeAdmin | handleRemoveAdmin
   DELETE /api/admin/teachers/${id}               handleDeleteTeacher
   PUT    /api/admin/teachers/${id}/mapel {mapel} handleSaveMapel
   POST   /api/admin/teachers                     AddTeacherForm
```

Every handler: `setLoading(id)` → `setMessage(null)` → `fetch` → `throw new Error(data.error ||
<Indonesian fallback>)` → success message → **local** `setTeachers(prev => prev.filter/map(...))`
→ `finally { setLoading(null) }`. The `mapel` endpoint is used only from this route. `profiles` is
the only table read; `mapel` is `JSONB` (supabase/schema.sql:15). Delete cascades server-side
through `absensis`.

## Component structure

All primitives live in `src/components/ui/`, imported at ts-manager-client.tsx:14-47:
`PageHeader`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`, the `Table*` set
(`TableScroll` and `TableCaption` included), `Badge`, `Dialog`, the `Dropdown*` set, `EmptyState`,
`FeedbackBanner`, `Field`/`Input`/`Label`/`Select`/`Textarea`, `Skeleton`, `Avatar`, and
`Button`/`ButtonLink`. `cn` is `@/lib/utils`; icons are `lucide-react` (`BookOpenCheck`,
`MoreHorizontal`, `Pencil`, `Plus`, `ShieldCheck`, `ShieldOff`, `Trash2`, `UserPlus`).

- **Card** (line 285): title "Daftar Guru", description `"{n} dari {total} guru ditampilkan"`, plus
  a right-aligned toolbar — labelled search `Input` (`#tsSearch`), the `mapelFilter` `Select`, a
  "Tambah Guru"/"Batal" toggle, and a `ButtonLink` to `/admin/import-teachers`.
  `AddTeacherForm` renders inline above the table when open. **Filtering** is a `useMemo` over
  `[teachers, searchQuery, mapelFilter]` (line 84), matching `name` or `email` case-insensitively
  ANDed with `hasMapel()` (line 68); `unassignedCount` (line 101) drives the info banner.
- **Table** (line 356): `TableScroll maxHeight="34rem"` gives the sticky `TableHead` a scroller;
  four columns **Guru · Mapel · Role · Aksi**, no `No` index column and **no pagination**. The
  Guru cell stacks `Avatar` + name + email, with the WhatsApp `Input` below while editing. The
  Mapel cell renders a `meta` class label plus a `Badge variant="info"` per subject, or a
  warning-toned "Belum ada mapel" marker when empty. Role uses `Badge variant="accent"` for
  `Admin`, `variant="success"` for `Guru`.
- **Aksi cell** (line 472): a "Mapel" `Button` (variant flips to `primary` when the teacher has no
  mapel) plus a `Dropdown` holding Edit/Selesai, J-Admin / J-Guru, and a danger-toned Hapus.
  Inline editing is opt-in per row: `editingTeacher` toggles and the label flips `Edit` ↔
  `Selesai`; the three fields commit on `onBlur` (name also on `Enter`) via `handleUpdateTeacher`,
  phone coerced with `|| null`. No cancel, no dirty check.

## `mapel` (subject) data model

`profiles.mapel` is JSONB: `Record<kelas, MapelValue>` where `MapelValue = string | string[]`
(ts-manager-client.tsx:58-60); every read normalises a lone string into a one-element array
(lines 455, 721). `MapelDialog` keeps the raw JSON **string** as the single source of truth:
`parsed` is a `useMemo` that `JSON.parse`s it and yields `null` for a non-object or array
(line 624). The structured rows, "Assign", and the per-subject / per-class remove buttons all
call `commit(next)`, which only does `onJsonChange(JSON.stringify(next, null, 2))` (line 636) —
they write *into the same text* the textarea renders, so the wire format never changes.
`handleAssign` (line 640) upper-cases the class key, splits subjects on commas, merges via
`Array.from(new Set(...))`; `handleRemove` drops the whole class when its last subject goes. The
payload is still exactly `{ mapel: parsed }` (line 247), parsed in the parent at line 240; invalid
JSON surfaces as "Format JSON tidak valid", and the dialog shows an error `FeedbackBanner` while
unparseable.

## Loading / empty / error states

- **Loading**: no route-level skeleton. While `loading` is set the body swaps to four `Skeleton`
  rows with `colSpan={4}` plus an `sr-only role="status"` "Memproses permintaan…" (lines 357-380);
  per-row `busy` disables that row's actions. **Empty**: `EmptyState` when
  `filteredTeachers.length === 0` (line 342), branching on `searchQuery || mapelFilter !== 'all'`.
- **Feedback**: a dismissible `FeedbackBanner` for `message` plus a `tone="info"` banner reporting
  `unassignedCount` (lines 273-283). Errors use `role="alert"`, successes `role="status"`. Delete
  confirm is a `Dialog size="sm"` (line 566) — not `window.confirm`. No SweetAlert2, no `useToast()`.

## Gotchas

- `handleUpdateTeacher` deletes an empty `password` from the body (line 195) so a blank field never
  resets credentials. `profiles` has no `email` column; the email edit only lands server-side via
  `auth.admin.updateUserById`.
- `Dialog` wraps the native `<dialog>` (`showModal`), so Escape and focus trapping are platform
  behaviour — do not add manual key handlers. `TableCaption` is `sr-only`, so its text is the
  table's accessible name. Icon-only controls must keep their `aria-label`.

## Style contract

Tokens are namespaced `--ds-*` in `src/app/globals.css` (surface / border / text / accent /
success / info / warning / danger families, lines 23-74) and reach markup through semantic
Tailwind utilities (`text-text-secondary`, `bg-surface-card`, `border-border-subtle`, `focus-ring`,
plus `.eyebrow` and `.meta` at globals.css:298 and :308). The legacy Bootstrap-parity layer
(globals.css:474, "LEGACY · BOOTSTRAP-PARITY CSS") and the brutalist layer (globals.css:1943,
"LEGACY · BRUTALIST DESIGN SYSTEM") **still exist** because the TEACHER pages (`/`, `/journal`,
`/absensi`, `/schedule`, `/prevSmes`, `/export`, `/profile`) are NOT yet migrated — do not assume
the legacy layer is gone, and do not add legacy classes here; this route uses `src/components/ui/*`
primitives only.
