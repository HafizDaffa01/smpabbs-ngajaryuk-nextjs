# src/app/explorer/

A single-page Supabase Storage browser for the `uploads` bucket, admin-only. One
file: `page.tsx` (201 lines), an `async` Server Component with **no `'use
client'`** and no client island. There is no `layout.tsx`, no `loading.tsx`, and
no `error.tsx`; all five mutation endpoints live outside this folder under
`src/app/api/explorer/*`.

The page is a read-only *lister*; every write action it renders targets the API
routes, and (as documented below) **all five of those targets are mis-wired**, so
the screen can browse but not create, upload, rename, or delete.

## Responsibility

- **List** the immediate children of one "directory" in the `uploads` bucket,
  paginated to the first 100, sorted by name.
- **Render a breadcrumb** for the current path.
- Offer four mutations, each as a plain HTML form or anchor: create folder,
  upload file, open folder, rename file, delete file/folder.
- Render an empty state when the directory has no children.

## Design

**Path convention.** The bucket has no real directories, so "path" is the
Storage object-key prefix. The page reads it from a single query param:

```ts
const currentPath = params.path || ''     // page.tsx:38
```

Child keys are then composed inline in three places with the same idiom:
`` `${currentPath ? `${currentPath}/${file.name}` : file.name}` `` (lines 159,
167, 174). There is no helper, no `joinPath`, and no normalisation, so a
trailing slash in `?path=` would produce `a//b`.

**Bucket is hard-coded in six places.** `supabase.storage.from('uploads')`
appears in the page once (line 41) and in each of the five API routes — there is
no shared `UPLOADS_BUCKET` constant. `supabase/schema.sql:304-308` documents the
bucket as `Public: false (use signed URLs)`, 5 MB, MIME-restricted to
`image/jpeg|png|gif|webp`; the code enforces a *different* policy server-side
(see below) and stores `getPublicUrl(...)` in `absensis.foto` instead of a signed
URL.

**Listing options are fixed, not user-controlled:**

```ts
storage.from('uploads').list(currentPath, {
  limit: 100, offset: 0,
  sortBy: { column: 'name', order: 'asc' },
})
```

There is no pagination UI, so a directory with more than 100 children silently
truncates with no indication.

**Folder detection is inverted — the central bug of this page.** The page
treats `file.id` truthiness as "is a folder":

```tsx
{file.id ? '📁 ' : '📄 '}   // line 149  — icon
{file.id ? 'Folder' : 'File'} // line 153 — Tipe column
{file.id && <a …>Buka</a>}    // line 157 — "open" link
{!file.id && <a …>Rename</a>}  // line 165 — "rename" link
action={`/explorer/delete-${file.id ? 'folder' : 'file'}…`}  // line 174
```

But `@supabase/storage-js@2.112.3` documents, in
`dist/index.d.cts:190-191`:

```ts
/** Unique identifier for the file (null for folders) */
id: string | null;
```

so **`id` is `null` for folders and a uuid string for files** — exactly the
inverse of what the page assumes. Every rendered row therefore shows the wrong
icon, the wrong "Tipe", the wrong action set (folders offer Rename, files offer
Buka), and posts the delete to the wrong route.

**Folders are faked with a zero-byte `.gitkeep`.** `POST /api/explorer/folder`
uploads `Buffer.from('')` to `` `${folderPath}/.gitkeep` `` after validating
`/^[a-zA-Z0-9_-]+$/` on the new name (line 35) — Supabase Storage has no `mkdir`, so a
placeholder object is the only way to make a prefix appear in `list()`.
Consequences visible in the UI: the `.gitkeep` object is itself listed as a row
inside the folder, and "deleting" a folder (below) removes the placeholder plus
one level of children.

**Forms use `action` + `method` + `formAction`, not client fetches.** All four
mutation affordances are plain HTML:

| UI | Markup | Method | Target |
|---|---|---|---|
| Buat Folder | `<form action={/explorer?path=…} method="GET">` + `<button formAction="/explorer/folder">` (88-105) | GET | `/explorer/folder` |
| Upload | `<form action={/explorer?path=…} method="GET" encType="multipart/form-data">` + `<button formAction="/explorer/upload">` (107-122) | GET | `/explorer/upload` |
| Buka | `<a href={/explorer?path=…}>` (158-164) | GET | works |
| Rename | `<a href={/explorer/rename?path=…}>` (166-172) | GET | `/explorer/rename` |
| Hapus | `<form action={/explorer/delete-{file\|folder}?path=…} method="POST">` with `onSubmit` `confirm()` (173-188) | POST | `/explorer/delete-file` or `/explorer/delete-folder` |

The `formAction`/`action` attributes point at **page routes without the `/api`
prefix**, and the verbs and encodings do not match the handlers:

- `/explorer/folder` is `POST` + `await request.json()`; the form issues `GET`
  with `application/x-www-form-urlencoded` body → the request lands on the
  `page.tsx` route's `GET` handler (which ignores it) or 404s, and even if it
  reached the handler the JSON parse would throw.
- `/explorer/upload` is `POST` + `await request.formData()`; the form issues
  `GET` with `multipart/form-data` → body never parsed.
- `/explorer/rename` is `POST` + JSON `{oldPath, newName}`; the link issues a
  plain `GET` with a single `path` param and offers no UI to enter a new name.
- `/explorer/delete-file` and `/explorer/delete-folder` are both **`DELETE`** +
  JSON `{path}`; the forms issue **`POST`** with the path in the **query string**
  → wrong verb, wrong body, and no `path` in the JSON.

The only affordance that actually works is **Buka** (a plain `<a href>` to
`/explorer?path=…`), and it is only attached to rows the code thinks are files.

**Confirm-then-submit is the only safety rail.** The delete form's
`onSubmit` calls `window.confirm('Apakah Anda yakin ingin menghapus ini?')` and
`preventDefault()` on cancel. Since the request never reaches a handler, this is
currently the *only* thing preventing a delete — and the wording is generic
enough that it does not name the target.

**Layout / styling.** `<div className="min-vh-100 bg-body">` +
`<main className="container pb-5">` + one `.card-brutalist`, with
`.card-brutalist-header` carrying `.section-label` `FILE_EXPLORER`, an `<h1
className="h3 mb-0 text-white">File Explorer</h1>`, and a
`← Kembali` `<Link href="/admin">` styled `.btn-brutalist-outline`. `.min-vh-100`
has no rule in `globals.css`. The inner table and all action buttons are
**Bootstrap 5**, not brutalist: `.table.table-hover`, `.btn-sm.btn-primary`,
`.btn-sm.btn-warning`, `.btn-sm.btn-danger`, `.form-control`, `.text-end`,
`.d-flex.justify-content-end.gap-2`. The breadcrumb uses `.text-primary-bold`
(defined once in `globals.css`) and `.text-muted`, and maps
`currentPath.split('/')` with a `<React.Fragment>`-less shorthand `<>…</>` whose
children are unkeyed-at-the-fragment-level (the `<span key={index}>` carries the
key, so React warns-free but the fragment boundary is a lint smell).
`docs/brutalist-design-spec.md` has **no section for `/explorer`** — the page is
undocumented in the design spec.

**Empty state is hand-rolled**, not the shared `EmptyState`
(`src/components/ui/empty-state.tsx`, which is itself unused):

```tsx
{files?.length === 0 && (
  <tr><td colSpan={3} className="text-center">
    <div className="empty-state"><i className="fas fa-inbox"></i><p>Folder kosong</p></div>
  </td></tr>
)}
```

## Data Flow

**Read path.**

```
GET /explorer?path=a/b/c
  page.tsx (Server Component)
    await cookies() → createClient(cookieStore)          (RLS / user-scoped)
    auth.getUser()                       → redirect('/login')       if !user
    profiles.select('is_admin').single() → redirect('/unauthorized') if !is_admin
    currentPath = params.path || ''
    storage.from('uploads').list(currentPath, {limit:100, offset:0,
                                               sortBy:{column:'name',order:'asc'}})
    render table rows: 📁/📄 + name, Tipe, [Buka|Rename] + delete form
```

The only Supabase read on this page is the `list()` call; nothing touches
`absensis`, so a file in the bucket is not cross-referenced with any attendance
record (and orphaned photos are invisible here — the only way to spot them is
`GET /api/export?type=zip`, which fetches whatever `absensis.foto` points at).

**Write paths as *implemented* (per the API routes), none of which the UI
triggers:**

| Endpoint | Verbs | Body | Validation | Effect |
|---|---|---|---|---|
| `POST /api/explorer/folder` | POST | JSON `{path, newFolder}` | `newFolder` required; `/^[a-zA-Z0-9_-]+$/` | `upload(`${path}/${newFolder}/.gitkeep`, Buffer.from(''))` — no `upsert`, so a duplicate name 500s |
| `POST /api/explorer/upload` | POST | `formData`: `file`, `path` | `file.size <= 10 * 1024 * 1024`; `file.type` startsWith one of `image/`, `application/pdf`, `application/zip`, `application/x-zip-compressed`, `text/` | `upload(`${path}/${file.name}`, file, {upsert:true})` |
| `POST /api/explorer/rename` | POST | JSON `{oldPath, newName}` | both required; `/^[a-zA-Z0-9_.-]+$/` on `newName` | `download(oldPath)` → `upload(newPath, fileData, {upsert:true})` → `remove([oldPath])` |
| `DELETE /api/explorer/delete-file` | DELETE | JSON `{path}` | `path` required | `remove([path])` |
| `DELETE /api/explorer/delete-folder` | DELETE | JSON `{path}` | `path` required | `list(path)` → `remove(files.map(f => `${path}/${f.name}`))` |

All five repeat the same auth preamble (`auth.getUser()` → 401
`Unauthorized`; `profiles.select('is_admin').single()` → 403 `Forbidden`) and the
same `catch → 500 { error: 'Terjadi kesalahan server' }`. Distinct error strings:
`Nama folder harus diisi`, `Nama folder hanya boleh huruf, angka, underscore, dan
dash`, `File tidak ditemukan`, `File tidak ditemukan` (404 in rename),
`Path harus diisi`, `File tidak ditemukan` (upload),
`Ukuran file maksimal 10MB`,
`Tipe file tidak diizinkan. Hanya gambar, PDF, ZIP, dan dokumen teks.`,
`Path dan nama baru harus diisi`,
`Nama hanya boleh huruf, angka, underscore, dash, dan titik`.

**Rename is a copy-then-delete, not a rename.** `rename/route.ts:43-67`
downloads the object into memory, re-uploads it under the new key with
`upsert: true`, then removes the old key and only `console.error`s if that final
`remove` fails — so a failure leaves a duplicate, and the handler still returns
`{success:true}`.

**`delete-folder` is non-recursive and leaves the placeholder.** It lists only
the immediate children (`list(path)` with no options → default limit) and removes
`${path}/${child.name}`. A nested structure (`a/b/c.txt`) is listed at `a` as
`b`, and `a/b` is removed as a *key* — which does not delete `a/b/c.txt`; and the
`a/b/.gitkeep` created by `folder/route.ts` is only reachable one level down, so
after deleting `a/b` the prefix `a/b` may still exist. `list(path)` is also
unpaginated, so a folder with >1000 children is only partly cleared.

**Upload size/MIME policy contradicts the bucket policy.** The bucket is
documented as 5 MB and `image/jpeg|png|gif|webp` only (`schema.sql:307-308`),
while `upload/route.ts:36-49` accepts 10 MB and any `image/*`, `application/pdf`,
`application/zip`, `application/x-zip-compressed`, or `text/*`. The stricter
server-side bucket settings will reject some of what the route accepts (or vice
versa, depending on which was actually applied in the dashboard), and the route's
`file.type` check trusts the browser-supplied MIME type.

## Integration Points

**Upstream (imports).** `page.tsx` imports exactly four things:
`createClient` from `@/utils/supabase/server`, `cookies` from `next/headers`,
`redirect` from `next/navigation`, `Link` from `next/link`. No
`@/lib`, no `@/types`, no `@/components`, no icon library — the icons are the
emoji `📁` / `📄` and the Font Awesome `<i className="fas fa-inbox">`.

**Downstream (consumers).**

- In-app link: `src/app/admin/page.tsx:406` → `/explorer` (one of the admin
  tool cards). `middleware.ts:44,67` lists `/explorer` in both `protectedRoutes`
  and `adminRoutes`, and the page re-checks `is_admin` itself.
- Data: only the `uploads` Storage bucket, via
  `supabase.storage.from('uploads')`. No Postgres table is read or written by
  this page.
- The same bucket is written by `/api/absensi` (the attendance photo upload
  that populates `absensis.foto` with a `getPublicUrl`) and read by
  `src/app/export/page.tsx`'s "Gambar" tab (`<img src={record.foto}>`) and by
  `GET /api/export?type=zip`. So `absensis.foto` must hold a **public** URL for
  those to work, while the bucket is documented as private and this explorer
  offers no signed-URL or download action at all — a private bucket would make
  both the export preview and the ZIP silently fail.

**Layout note.** `src/app/explorer/` is outside the `(dashboard)` route group,
so no `Navbar` / `MobileNav` / `Scripts` — same as `/admin` and `/export`, and
the page re-creates its own shell with a `← Kembali` link to `/admin`.

**Known discrepancies / bugs.**

- **Folder/file classification is inverted** (`file.id` truthiness vs. the
  documented "null for folders"), which corrupts the icon, the Tipe column, the
  presence of Buka vs Rename, and the delete route for every row. This is the
  one bug to fix first: `file.id === null` is the correct test.
- **All five mutations target the wrong URLs/verbs/encodings** — missing `/api`
  prefix (`formAction="/explorer/folder"` vs. the real
  `/api/explorer/folder`), `GET` forms against `POST` handlers, `multipart`
  against `request.formData()` (which would work, but the verb is wrong), and
  `POST` forms against `DELETE` handlers with a query-string path instead of a
  JSON body. Nothing in the UI can create, upload, rename, or delete.
- **Rename has no UI at all** — it is a bare `<a href="/explorer/rename?path=…">`,
  and the handler expects `POST` JSON `{oldPath, newName}`.
- **No pagination** (`limit: 100`, `offset: 0` hard-coded, no controls) and no
  indication that a directory is truncated.
- **`.gitkeep` placeholder leaks into the UI** as a normal file row inside every
  folder created through the API.
- **`delete-folder` is not recursive** and does not remove the folder's
  placeholder or any grandchildren, yet reports `{success:true}`.
- **`folder/route.ts` has no `upsert`**, so creating a folder whose name already
  exists returns 500 with the raw Supabase message.
- **`rename/route.ts` is not atomic** — download → upload → remove, with a
  `console.error` on the final remove and `success: true` regardless, so a
  partial failure duplicates the object.
- **Upload policy mismatch** with the bucket (10 MB / pdf+zip+text accepted vs.
  the documented 5 MB / images only), and the `file.type` check trusts a
  client-supplied value.
- **The empty-state check is `files?.length === 0`** (line 136), so when
  `list()` errors and `files` is `null` the table renders with **no rows and no
  message at all** — an error and an empty directory are indistinguishable.
- **No `metadata`, size, or updated_at is displayed**, even though
  `FileObject` carries all three, so an admin cannot tell a 4 MB photo from a
  `.gitkeep`.
- **No path sanitisation on read.** `?path=../../other-prefix` is passed straight
  to `list()`, and the only name validation is on the create/rename handlers'
  inputs — the explorer will happily browse any prefix of the bucket.
- **Delete confirmation text is generic** (`'Apakah Anda yakin ingin menghapus
  ini?'`) and the target file/folder name is not interpolated, so a mis-click is
  hard to catch.
- `/backup` is in the middleware's protected/admin lists but **no
  `src/app/backup/` route exists** — the two lists were presumably written
  together with `/explorer`'s admin card and the dead entry never removed.
