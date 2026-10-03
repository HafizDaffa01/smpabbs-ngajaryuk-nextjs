# src/app/admin/teachers/

Teacher account management: list the non-admin `profiles` rows, add a teacher, edit
name/email/phone/password, promote to admin, delete. A narrower sibling of `../tsmanager`
(no `mapel` editing, admins excluded). Linked as "Guru" from `src/components/admin/sidebar.tsx:47`.

## Purpose

Guard the route (admin only), drive CRUD through `/api/admin/teachers`, expose `Tambah Guru`,
`Edit`, `Jadikan Admin`, `Hapus` per row plus name/phone search and a mapel-presence filter.

## Entry points

Files: `page.tsx` (async Server Component, no `'use client'`, 56 lines),
`teacher-table.tsx` (`'use client'`, 546 lines), `codemap.md`. Nothing else lives here.
`page.tsx` exports `metadata` (title `Manajemen Guru - NgajarYuk`) and `AdminTeachersPage`,
which renders `PageHeader` (title, `crumbs` Beranda → Admin → Guru, description) then
`<TeacherTable teachers={teachers ?? []} />` in a `flex flex-col gap-5` wrapper.
`teacher-table.tsx` opens the client boundary on line 1: default export
`TeacherTable({ teachers }: { teachers: Teacher[] })`, plus local `AddTeacherForm` (line
373, inline form inside `CardContent`, mounted when `showAddForm`) and `EditTeacherDialog`
(line 446, `Dialog`-wrapped form mounted when `editingTeacher`). The local `Teacher` type
(line 40) mirrors the `profiles` row: `id`, `name`, `email?`, `phone_num?`, `is_admin`,
`mapel?`.

## Auth and data flow

- Guard (`page.tsx:13-32`): `await cookies()` → `createClient(cookieStore)` →
  `supabase.auth.getUser()` → `redirect('/login')` if no user.
- Admin check (`page.tsx:24-32`): `profiles.select('is_admin').eq('id', user.id).single()` →
  `redirect('/unauthorized')` when `!profile?.is_admin`.
- List query (`page.tsx:35-39`), the only read and it happens in the page:
  `profiles.select('*').eq('is_admin', false).order('name')`. Mutations go through `fetch()`
  from the client component; nothing is patched locally.

| Caller | Request | Route Handler | Effect |
|---|---|---|---|
| `handleDeleteTeacher` (90) | `DELETE …/teachers/${id}` | `api/admin/teachers/[id]/route.ts:154` | `absensis.delete().eq('user_id',id)` → `profiles.delete()` → `auth.admin.deleteUser(id)` |
| `handleMakeAdmin` (118) | `PUT …/${id}/make-admin` | `…/[id]/make-admin/route.ts:33` | `profiles.update({ is_admin: true })` |
| `AddTeacherForm` (377) | `POST …/teachers` | `api/admin/teachers/route.ts:80` | `auth.admin.createUser` → `profiles.insert`, auth user rolled back on failure (103) |
| `EditTeacherDialog` (456) | `PUT …/teachers/${id}` | `api/admin/teachers/[id]/route.ts:85` | `profiles.update({name?, phone_num?})` + `auth.admin.updateUserById` for `email` (error only logged, 102) and `password` (error returned 500, 113) |

Responses are `{ success: true }`, `{ success: true, user }` (POST) or `{ error }` with
400/401/403/404/500; every handler repeats the `getUser()` + `profiles.is_admin` gate, so
a non-admin hits 403 even if middleware were bypassed. The `…/[id]/remove-admin` and
`…/[id]/mapel` handlers exist but are unreachable here.

## Component structure

Design-system primitives from `@/components/ui/` only, no hand-rolled markup. Icons are
`lucide-react` (`MoreHorizontal`, `Pencil`, `ShieldCheck`, `Trash2`), `aria-hidden size-4`.

- `PageHeader` (title, breadcrumb trail, description, `page.tsx:43`) and `Card` /
  `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` — one card wraps the
  toolbar and table region (`teacher-table.tsx:154-329`); `CardHeader` holds the
  "`N` dari `M` guru ditampilkan" count, the `Cari guru` input, the `Mapel` select and the
  `Tambah Guru` / `Batal` toggle.
- `Table` / `TableCaption` / `TableScroll` / `TableHeader` / `TableBody` / `TableRow` /
  `TableHead` / `TableCell` — `TableScroll label="Daftar guru" maxHeight="34rem"` gives the
  sticky header a scroller (`table.tsx:75`). Six columns: `No`, `Guru`, `No. WhatsApp`,
  `Mapel`, `Role`, `Aksi`; `TableCaption` is `sr-only`.
- `Avatar` (initials, `size="sm"`, tone hashed from the name, `avatar.tsx:18`) and `Badge`
  — `Mapel` column (`info` when assigned, else `neutral`), `Role` column (`accent` for
  `Admin`, `success` for `Guru`).
- `Dropdown align="end"` + `DropdownTrigger` / `DropdownContent` / `DropdownLabel` /
  `DropdownItem` / `DropdownSeparator` — one `MoreHorizontal` icon button per row holds
  `Edit`, `Jadikan Admin`, `Hapus`; the trigger is hand-styled via `cn()` plus `focus-ring`.
- `Dialog` — native `<dialog>` with `size` / `title` / `description` / `footer`
  (`dialog.tsx:40`), used for the delete confirmation and the edit form, so focus trap and
  Escape come from the platform. `FeedbackBanner` — `tone="success" | "error"`.
- `EmptyState` (zero results, text switches on whether a filter is active,
  `teacher-table.tsx:201`), `Skeleton` (placeholder rows during mutation), and
  `Field` / `Input` / `Select` / `Label` — both forms use `Field` as a render-prop wrapper
  injecting `id` / `aria-describedby` / `aria-invalid` / `aria-required` (`input.tsx:114`).

## Loading, empty and error states

- **Loading:** no `loading.tsx`, so first paint blocks on the query. `loading: string | null`
  holds the id of the row being mutated; while set, the whole `TableBody` is replaced by 4
  same-height placeholder rows (`teacher-table.tsx:235-242`) plus an `sr-only`
  `role="status"` "Memproses permintaan…", so nothing jumps. Sub-forms own a separate
  `loading: boolean` driving `Button loading loadingText="Menyimpan..."`.
- **Empty:** `EmptyState` reads "Tidak ada guru yang cocok dengan pencarian." when a search
  or mapel filter is active, otherwise "Belum ada data guru." with a hint to use
  `Tambah Guru`. **Error / success:** table level `message` renders a dismissible
  `FeedbackBanner`; form level `error` renders a non-dismissible `tone="error"` banner
  inside the form. The `Field` `error` prop exists but is unused. No SweetAlert2, no
  `useToast()`.

## Gotchas

- **No pagination.** The whole `profiles` result set is rendered; only the client-side
  `useMemo` filter narrows it (search over name/email/phone, plus the mapel filter).
- **`loading` is all-or-nothing.** It holds a single id and the ternary at
  `teacher-table.tsx:235` is truthy whenever it is set, so the per-row `busy` flag and the
  `disabled` props on the dropdown items effectively never render.
- **`window.location.reload()` after every successful mutation** (107, 134, 404, 488) — a
  full server re-render rather than local state patching, so the success banner is rarely
  seen. Failures never navigate.
- **No demote branch.** The query filters `is_admin = false`, so only `Jadikan Admin` is
  offered; remove-admin is unused. **Password fields use `type="text"`**, not
  `type="password"`, in both forms.
- **`email` is not a `profiles` column** (`supabase/schema.sql:10`), so the email line in
  every row renders `-`; the edit form still posts `email`, applied via `auth.admin.updateUserById`.
- **Uncontrolled inputs** with `defaultValue` in the edit dialog, so a `teacher` prop change
  does not reset the fields. Its submit button sits in the `Dialog` `footer` and reaches
  the form via `form="edit-teacher-form"` (509).
- **`mapel` is JSONB** (`subject → string[]`); the column shows the summed list length, not
  subject names — editing happens in `../tsmanager`. Both forms read
  `new FormData(event.currentTarget)` for `name`, `email`, `password`, `phone_num`, coercing
  `phone_num` with `phoneNum || null` and adding `password` only when non-empty.

## Style contract

- Tokens are namespaced `--ds-*` in `src/app/globals.css` (e.g. `--ds-accent`,
  `--ds-surface-card`, `--ds-text-secondary`, `--ds-border-default`, `--ds-danger-text`),
  consumed through Tailwind utilities (`bg-surface-card`, `text-text-primary`,
  `border-border-subtle`, `bg-danger-bg`, `rounded-sm` / `rounded-md`, `focus-ring`,
  `action-row`, `eyebrow`) — never raw hex and never the deleted legacy class names.
- The legacy Bootstrap-parity layer (`LEGACY · BOOTSTRAP-PARITY CSS`, `globals.css:475`)
  and the brutalist layer (`LEGACY · BRUTALIST DESIGN SYSTEM`, `globals.css:1943`) still
  exist and must not be deleted or rewritten: the teacher pages `/journal`, `/absensi`,
  `/schedule`, `/prevSmes`, `/export`, `/profile` and other not-yet-migrated admin screens
  still render them. The new design system is strictly additive.
- This directory is fully migrated: no brutalist card/button/input/table/modal classes, no
  FontAwesome `<i>` icons, no Bootstrap `d-flex` / `table-responsive` helpers. Layout is
  utility-only: `flex flex-col gap-4` at the table root, `gap-5` on the page, `sm:` prefixes
  for responsive widths, and `min-w-[680px]` so `TableScroll` handles narrow viewports.