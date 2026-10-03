# Function-Level Inventory — NgajarYuk Next

A measured audit of function-level debt in the Laravel→Next.js port.

## Snapshot & method

| | |
|---|---|
| Snapshot taken | **2026-09-30 20:14 WIB** |
| Git HEAD | `4a08729` |
| Working tree | **dirty — 117 modified/untracked paths**; a concurrent refactor was moving pages into `src/app/(dashboard)/` during the audit |
| API route files | **41** (`src/app/api/**/route.ts{,x}`) |
| Source files scanned | **118** `.ts`/`.tsx` under `src/`, plus `middleware.ts` |

**There is no test suite and no test runner in this repository.** No `*.test.*` / `*.spec.*`
file exists anywhere under `src/`. Every claim below is therefore backed by static evidence:
`grep` call-site enumeration, MD5 hashing of extracted code blocks, and `node -e` runtime
probes of the installed dependency. Reproduce the headline numbers with:

```bash
npx tsc --noEmit                      # CLEAN at 20:14 — see the drift note in §9
node -p "require('sweetalert2/package.json').version"
node -e "const S=require('sweetalert2');console.log(typeof S.setDefaults)"   # -> undefined
```

> **`npx tsc --noEmit` passing is not evidence of correctness here.** The one live
> `TypeError` in this codebase (§8.1) is hidden from the compiler by a deliberate type cast.
> A clean type-check is the expected state and tells you nothing about that bug.

**Contamination warning.** `codemap.md` files are generated prose that quote source line
numbers. They are *stale* (e.g. `src/app/error/codemap.md:77` still cites
`src/app/explorer/page.tsx:34`, a file deleted in this refactor). **All greps in this document
exclude `codemap.md` and `docs/`.** A first pass that did not exclude them produced false
positives and every one of them is corrected or retracted in §9.

---

## Severity scale

| Level | Meaning |
|---|---|
| **Critical** | Throws on a live user path; feature is down right now. |
| **High** | Data is silently wrong, lost, or reachable by the wrong audience. |
| **Medium** | Feature is broken but the failure is visible, or the risk is conditional. |
| **Low** | Refactor-only / maintainability. No behavioural change. |
| **Dead** | No effect on behaviour. Safe to delete. |

---

## 1. Duplicated auth blocks

### 1.1 — 34 byte-identical admin preambles across 27 route files · **High (maintainability amplifier)**

Every admin API handler opens with the same 20 lines. Extracted with the regex
`const cookieStore = await cookies\(\)[\s\S]*?status: 403 \}\)\n\s*\}\n` and grouped by MD5:

| Variant | Copies | Files | MD5 |
|---|---|---|---|
| Admin preamble (4-space indent) | **34** | **27** | `dc4e155b` |
| Same preamble, 2-space indent | **2** | 2 (`export/pdf/rekap-{kbm,presensi}/route.tsx`) | `21c06e15` |
| **Total** | **36** | 29 | 2 variants |

Copy distribution — 27 files carry one copy each, plus:
`admin/absensi/route.ts` ×3, `admin/student/route.ts` ×3, `admin/teachers/[id]/route.ts` ×3,
`admin/teachers/route.ts` ×2.

Canonical body (`src/app/api/admin/absensi/route.ts:7-26`):

```ts
const cookieStore = await cookies()
const supabase = createClient(cookieStore)
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
const { data: profile } = await supabase
  .from('profiles').select('is_admin').eq('id', user.id).single()
if (!profile?.is_admin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

- **What breaks:** nothing today. It is the reason the *next* bug exists — 9 route files
  forgot the block entirely (§1.3), and nothing in the type system or the compiler notices,
  because the guard is copy-paste rather than a function.
- **Change risk:** **Low.** Extract `withAdmin(handler)` / `requireAdmin(supabase, user)`
  into `src/utils/supabase/server.ts` and replace all 36 call sites. Pure mechanical;
  the compiler catches every site because the block becomes a required argument.

### 1.2 — 20 byte-identical RSC auth gates · **Low**

Same pattern in server components. MD5 `a413fd45`, 20 copies, 20 distinct files: every page in
`src/app/(dashboard)/**`, all 6 pages under `src/app/admin/`, plus `src/app/error/page.tsx:23`,
`src/app/success/page.tsx`, `src/app/unauthorized/page.tsx`, and `src/app/admin/layout.tsx`.

- **What breaks:** nothing. Note these three terminal-state pages *require a session* to show
  an error message, so an anonymous visit to `/error?message=...` is bounced to `/login`.
- **Change risk:** **Low.** Extract a `getAdminSession()` / `requireUser()` helper.

### 1.3 — 9 route files have no `is_admin` guard · **High (partly)**

32 of 41 route files contain `is_admin`. The 9 that do not:

| File | Verdict |
|---|---|
| `src/app/api/import-students/route.ts` | **BUG — see §8.2.** Writes to `students` with only an auth check. |
| `src/app/api/auth/login/route.ts` | Correct — login must be open. |
| `src/app/api/auth/logout/route.ts` | Correct. |
| `src/app/api/profile/route.ts` | Correct — scoped to the caller's own row. |
| `src/app/api/profile/password/route.ts` | Correct. |
| `src/app/api/absensi/route.ts` | Correct — teacher self check-in. |
| `src/app/api/journal/save-all/route.ts` | **Unconfirmed.** Reads own notes, but I could not prove it cannot write another teacher's row. |
| `src/app/api/journal/save-note/route.ts` | **Unconfirmed.** Same. |
| `src/app/api/schedule/preview/route.ts` | Correct — read-only preview. |

I could not confirm whether `save-all` / `save-note` are properly owner-scoped; they are
flagged for review rather than asserted as broken.

### 1.4 — `middleware.ts` re-implements the Supabase client · **Low**

`middleware.ts:11-29` hand-rolls a `createServerClient` with a real `setAll`, while
`src/utils/supabase/server.ts:9-21` has an **empty `setAll` at `:17`**:

```ts
setAll() {
},
```

- **What breaks:** server components and route handlers never refresh the auth cookie on
  token rotation. Sessions silently rely on the refresh happening elsewhere.
- **Change risk:** **Medium.** Cookie writing must work on both sides of the render, but the
  middleware copy is the only one that is correct today. Extract a shared factory and verify
  refresh-on-navigation before deleting either copy.

### 1.5 — Middleware route lists contradict the filesystem · **Medium**

`middleware.ts:109-112` matches **every** path except static assets, so all `/api/*` traffic
pays for it — yet `/api` appears in neither list:

- `protectedRoutes` (`:37-46`) — contains `/backup`, **no such route exists** (only
  `/api/export/backup-save` and `export/backup-client.tsx`).
- `adminRoutes` (`:64-71`) — also contains `/backup`. Dead config in two lists.
- **`/schedule` is absent from `protectedRoutes`** — `src/app/(dashboard)/schedule/` is
  reachable without a session at the middleware layer. Each page re-checks internally, so this
  is defence-in-depth loss rather than a live hole.
- No `/api` entry ⇒ each route hand-rolls its own guard ⇒ §1.1.

- **What breaks:** dead config misleads readers about what is protected; the middleware is
  the only place a route list is documented.
- **Change risk:** **Low.** Delete `/backup` from both lists; add `/schedule`; derive
  `/api` protection from a shared table so §1.1 has a single source of truth.

### 1.6 — Double auth round trip on every request · **Low**

`middleware.ts:31` calls `await supabase.auth.getClaims()` and **discards the result**, then
`:55` and `:99` call `auth.getUser()` for the same request.

- **What breaks:** one wasted JWT→DB verification per navigation.
- **Change risk:** **Low.** Delete `:31` once confirmed no downstream reader needs it.

---

## 2. Dead / unreachable endpoints

Method used: extract **every** `/api/…` literal from all 118 source files plus
`middleware.ts`, tag its mechanism (`fetch` + `method:`, `href=`, `window.open`), then map
each occurrence to the **longest** matching route path so `/api/export` does not shadow
`/api/export/backup-save`.

> Three earlier passes in this audit produced false "uncalled" verdicts, each time because
> the probe only matched one calling mechanism. `export`, `export/export-lokasi`,
> `export/export-waktu` and `journal/export` are reached by `href=` / `window.open()`, not
> `fetch()`. The numbers below are from the corrected pass.

### 2.1 — 13 route files with zero callers · **Dead**

| Route file | Exports | Lines |
|---|---|---|
| `src/app/api/admin/student/route.ts` | `GET, POST, DELETE` | 3 |
| `src/app/api/admin/student/update-grade/route.ts` | `PUT` | 1 |
| `src/app/api/admin/students/[id]/route.ts` | `DELETE` | 1 |
| `src/app/api/admin/students/[id]/update-grade/route.ts` | `PUT` | 1 |
| `src/app/api/auth/session/route.ts` | `GET` | 1 |
| `src/app/api/explorer/delete-file/route.ts` | `DELETE` | 1 |
| `src/app/api/explorer/delete-folder/route.ts` | `DELETE` | 1 |
| `src/app/api/explorer/folder/route.ts` | `POST` | 1 |
| `src/app/api/explorer/rename/route.ts` | `POST` | 1 |
| `src/app/api/explorer/upload/route.ts` | `POST` | 1 |
| `src/app/api/export/pdf/rekap-kbm/route.tsx` | `GET` | 1 |
| `src/app/api/export/pdf/rekap-presensi/route.tsx` | `GET` | 1 |
| `src/app/api/schedule/[id]/route.ts` | `GET, PUT, DELETE` | 3 |

**17 exported verbs, zero inbound requests.**

- **What breaks:** nothing. But they are still shipped, still carry the 36-preamble auth
  cost, and two of them (`schedule/[id]`) are *broken* (§8.6) — dead code that looks alive.
- **Change risk:** **Low**, with one caveat: `admin/student` + `students/[id]` are a
  singular/plural pair where the plural form is the one the UI *should* call (§3.1). Decide
  first whether to keep one or both; deleting both silently would remove the only student
  write path. `export/pdf/*` should be checked against browser bookmarks before deletion —
  they are GET endpoints, so an external link would be the only caller a grep can find.

### 2.2 — 32 exported verbs with no call site · **Dead / Low**

Beyond the 13 whole files, these verbs are exported inside otherwise-live files:

| Route | Dead verb | Note |
|---|---|---|
| `admin/absensi` | `DELETE` (`:69`), `PUT` (`:126`) | §3.3, §8.9 |
| `admin/teachers` | `GET` | RSC queries Supabase directly instead |
| `admin/teachers/[id]` | `GET` | same |
| `auth/login`, `auth/logout` | `GET` | CSRF/logout-via-link affordance, unused |
| `import-students` | `GET` | |
| `profile`, `profile/password` | `GET` | |
| `schedule` | `POST` | |
| `schedule/preview` | `GET` | |

- **Change risk:** **Low.** Note `admin/absensi`'s `PUT` is dead *and* has a mass-assignment
  hole (§8.9) — delete it rather than fix it.

### 2.3 — One verb mismatch that returns **405** · **High**

The only route in the app where the client's HTTP verb is not exported:

```
src/app/api/admin/absensi/[id]/route.ts:5   export async function DELETE(   ← only DELETE
src/app/admin/absensi/absensi-client.tsx:291-292
    await fetch(`/api/admin/absensi/${editingCell.recordId}`, { method: 'PUT', … })
```

- **What breaks:** the entire inline-edit feature in the admin attendance grid. Clicking a
  cell and saving returns **405 Method Not Allowed** every time. See §8.5.
- **Change risk:** **Medium** — do not "fix" this by adding a PUT handler that copies the
  mass-assignment at `admin/absensi/route.ts:149`. See §8.9 for the safe shape.

---

## 3. Redundant parallel endpoint families

### 3.1 — `admin/student` vs `admin/students/[id]` · **Dead + Low**

`students` (plural) exists only as `DELETE`; `student` (singular) carries `GET, POST, DELETE`.

The two `DELETE` bodies differ by exactly one line:

```
students/[id]/route.ts:32   await supabase.from('attendances').delete().eq('student_id', id)
students/[id]/route.ts:34   const { error } = await supabase.from('students').delete().eq('id', id)
                           → `error` is returned, but the line-32 result is NEVER checked

student/route.ts:148        const { error } = await supabase.from('students').delete().eq('id', id)
                           → no attendances sweep at all
```

The sweep in the plural route is **FK-redundant**: `supabase/schema.sql:63` declares
`student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE`. Postgres
already cascades. The only thing the extra line adds is an *unchecked* write that can fail
silently.

- **What breaks:** nothing today (both are dead). The divergence is a trap: if someone
  revives the plural route they get a redundant write with an ignored error.
- **Change risk:** **Low.** Keep one. Prefer the singular, which is already checked, and let
  the FK cascade.

### 3.2 — `admin/student/update-grade` vs `admin/students/[id]/update-grade` · **Dead + Low**

Both emit a byte-identical UPDATE; only the `id` source and the validation message differ:

```
student/update-grade/route.ts:37-40            students/[id]/update-grade/route.ts:41-44
  const { id, grade } = await request.json()     const { grade } = await request.json()   ← id from params
  .from('students')                              .from('students')
  .update({ grade: grade.toUpperCase() })        .update({ grade: grade.toUpperCase() })
  .eq('id', id)                                  .eq('id', id)
```

Difference in the error text only: `'ID siswa dan kelas harus diisi'` vs `'Kelas harus diisi'`.

- **Change risk:** **Low.** Consolidate to the `[id]` form (id in the path is the correct
  REST shape) and delete the singular twin.

### 3.3 — `admin/absensi` (3 verbs) vs `admin/absensi/[id]` (1 verb) · **Medium**

`admin/absensi` exports `GET`(`:5`), `DELETE`(`:69`), `PUT`(`:126`).
`admin/absensi/[id]` exports only `DELETE`(`:5`).

The split is incoherent: the client sends **`PUT` to `/[id]`** (§2.3) and **`DELETE` to
`/[id]`**, while the collection-level `DELETE` and `PUT` handlers sit unused. Two of the four
handlers on `admin/absensi` are unreachable, and one of them is the vulnerable one (§8.9).

- **What breaks:** inline attendance editing (§8.5); the collection `PUT`/`DELETE` are dead.
- **Change risk:** **Medium.** Delete the dead collection verbs, add a scoped `PUT` on
  `/[id]` that allow-lists its writable columns.

### 3.4 — `admin/absensi/delete-all` vs `delete-by-period` · **Low**

Same guard, same delete, differing only in the filter — and **both filter on columns that do
not exist** (§8.3). `delete-by-period` is genuinely broken; `delete-all` is not, so the pair
disagree on whether filtering works at all.

- **Change risk:** **Low** once §8.3 lands.

---

## 4. Duplicated implementations

### 4.1 — PDF style tables + font registration, 4× · **Low**

MD5 of each `const styles = {…}` block:

| Block | MD5 | Lines | Locations |
|---|---|---|---|
| Presensi styles | `40df08bb` | 43 | `api/export/pdf/rekap-presensi/route.tsx` **≡** `components/pdf/rekap-presensi-pdf.tsx` |
| KBM styles | `103bdc5d` | 46 | `api/export/pdf/rekap-kbm/route.tsx` **≡** `components/pdf/rekap-kbm-pdf.tsx` |

Each pair is **byte-identical**, and each has its own `Font.register({…})`
(`api/export/pdf/rekap-{kbm,presensi}/route.tsx:7`, `components/pdf/rekap-*.tsx:5`).

The two files under `src/components/pdf/` are **orphans** — nothing imports them (§5.1) —
so the live duplication is really "dead copy + dead copy". Delete the components; the API
route files retain the only live copy.

- **Change risk:** **Low.** Pure deletion of unreferenced files.

### 4.2 — Class-grouping block, byte-identical ×2 · **Low**

MD5 `2d38bf96`, 19 lines, in:

- `src/app/(dashboard)/journal/page.tsx:39-57`
- `src/app/(dashboard)/prevSmes/page.tsx:28-46`

```ts
const rawClasses = [...new Set(schedules?.map((s) => s.class_name) ?? [])]
const classes: Record<string, string[]> = {}
for (const c of rawClasses) { … }   // split grade / sub-class
for (const grade in classes) { classes[grade] = classes[grade].sort() }
```

- **Change risk:** **Low.** Extract `groupClassesByGrade(schedules)` into `src/lib/`.

### 4.3 — Teacher management UI: ~1,000 lines across two near-clones · **Medium**

| File | Lines |
|---|---|
| `src/app/admin/user-table.tsx` | 473 |
| `src/app/admin/teachers/teacher-table.tsx` | 545 |
| `src/app/admin/tsmanager/ts-manager-client.tsx` | 565 (third surface) |

Measured similarity — **68.2%** normalized `difflib.SequenceMatcher` ratio; **64%** Jaccard
over identifiers (230 shared, 30 unique to `user-table`, 99 unique to `teacher-table`).

> **Correction:** an earlier pass described these as "~90% identical". That was wrong.
> 68.2% is the measured figure.

**Both are live and both hit the same endpoints** — `make-admin` is called from
`user-table.tsx:98`, `ts-manager-client.tsx:68` **and** `teacher-table.tsx:123`;
`remove-admin` from `user-table.tsx:125` and `ts-manager-client.tsx:97`.
`mapel` is called only from `ts-manager-client.tsx:174`.

- **What breaks:** nothing. But three tables implement the same admin workflow; a fix to the
  auth or error-copy of one is not applied to the others (§7 quantifies this).
- **Change risk:** **Medium.** Deleting a table is a *product* decision (are `/admin`,
  `/admin/teachers` and `/admin/tsmanager` meant to be three tools?). Extract the shared
  presentational pieces first, merge last.

### 4.4 — Period / semester math in 5 places · **Low**

The semester→month-range constant is written out four times:

```
api/export/pdf/rekap-presensi/route.tsx:245-246   semester === 1 ? 1 : 7  /  ? 6 : 12
api/export/pdf/rekap-kbm/route.tsx:195-196         (same)
(dashboard)/prevSmes/show/page.tsx:44-45           (same)
(dashboard)/prevSmes/presensi/page.tsx:44-45       (same)
```

…and a fifth, differently-shaped variant already exists in the library:
`src/lib/period-system.ts:59  if (semester === 1) { … }`.

Meanwhile `period-system.ts` is imported by exactly **one** consumer
(`src/components/period-badge.tsx:3`, which takes only `getCurrentPeriod`).

- **What breaks:** nothing; a change to the school calendar needs 5 edits.
- **Change risk:** **Low.** Route all five through `period-system.ts`.

### 4.5 — Two different `PERIODS` tables · **Low**

```
src/lib/period-system.ts:15-28          PERIODS: Period[]  key:'jan_feb'  {startMonth,startDay,endMonth,endDay}
src/app/(dashboard)/export/page.tsx:13-26  const PERIODS = [             value:'1-2'    {label}
```

Same 12 periods, **different key formats** (`jan_feb` vs `1-2`), different field names, and
`export/page.tsx` redeclares the constant locally instead of importing the library's.
The library's `PERIODS` has no external consumer.

- **Change risk:** **Low**, but the key-format mismatch means merging them is a real
  translation, not a delete — the export page's `value="1-2"` is what reaches the query string.

### 4.6 — Grade-prefix (`ilike`) query block ×5 · **Low**

```
if (['7', '8', '9'].includes(grade)) {
  <query> = <query>.ilike('grade', `${grade}%`)
} else {
  <query> = <query>.eq('grade', grade)
}
```

Identical at `api/export/pdf/rekap-presensi/route.tsx:249`, `api/journal/export/route.ts:44`,
`(dashboard)/prevSmes/show/page.tsx:56`, `(dashboard)/prevSmes/presensi/page.tsx:52`,
`(dashboard)/journal/show/page.tsx:62`. A 6th near-copy widens `schedules` instead of
`students` at `journal/show/page.tsx:78`.

- **Change risk:** **Low.** Extract `applyGradeScope(query, grade)`.

### 4.7 — Export delete family · **Low**

`api/export/delete-all/route.ts` and `api/export/delete-by-period/route.ts` are the same
handler modulo a filter — and both share the fake image-deletion stub (§8.7).

---

## 5. Never-imported exports and unused locals

### 5.1 — 3 orphaned files · **Dead**

`grep -rn "from '@/types'\|from '../types'"` → **no results**. No import of
`@/components/pdf/*` anywhere in `src/`.

| File | Evidence |
|---|---|
| `src/types/index.ts` | 0 importers. Header at `:3` still reads *"Auto-generated from legacy Laravel models"* (§7). |
| `src/components/pdf/rekap-presensi-pdf.tsx` | 0 importers; byte-identical duplicate of a live API route (§4.1). |
| `src/components/pdf/rekap-kbm-pdf.tsx` | 0 importers; same. |

> **Two claims in this section were true at the 20:14 snapshot and were invalidated by the
> concurrent refactor at ~20:20 — re-verify before acting on them.**
>
> | File | Status at 20:14 | Status at 20:20 |
> |---|---|---|
> | `src/components/logout-button.tsx` | 0 importers | **imported** by `src/components/navbar.tsx:20` |
> | `src/components/ui/dropzone.tsx` | 0 importers | **imported** by `admin/import/import-form.tsx:13` and `admin/import-teachers/teacher-import-form.tsx:14` |
>
> `navbar.tsx` was deleted and then recreated (mtime 20:20) *during* this audit, which is why
> both files transiently had no importer. **Neither is dead code.** Drop them from any
> cleanup list; the only safe deletions here are `src/types/index.ts` and the two
> `src/components/pdf/*` copies.

- **Change risk:** **Low** for the 3 confirmed orphans. `dropzone.tsx` is now correctly wired
  to both import forms — it is *not* the missing explorer component, so reviving the explorer
  (§8.8) needs new work rather than reusing it.

### 5.2 — 5 dead exports · **Dead**

Zero non-definition references, verified by symbol grep across `src/`:

| Export | Location |
|---|---|
| `getPeriodDateRange` | `src/lib/period-system.ts:48` |
| `getSemesterMonths` | `src/lib/period-system.ts:58` |
| `formatPeriodLabel` | `src/lib/period-system.ts:65` |
| `getSubjectMapping` | `src/lib/subject-normalizer.ts:48` |
| `LEADERSHIP_CLASS_MARKER` | `src/lib/bell-schedule.ts:47` |

Also effectively dead: `PERIODS` (`period-system.ts:15`) — all 5 references are **inside
`period-system.ts` itself**; the similarly-named constant in `export/page.tsx:13` is a
separate local declaration (§4.5).

> **Correction:** `LEADERSHIP_CLASS_MARKER` is in `bell-schedule.ts:47`, **not**
> `v94-parser.ts` as originally reported.

- **Change risk:** **Low.** Note `getSemesterMonths` and `getPeriodDateRange` are exactly the
  helpers §4.4 needs — **wire them up rather than deleting**, then delete what stays unused.

### 5.3 — 3 write-only / unread locals · **Dead**

| Symbol | Location | Note |
|---|---|---|
| `allExpanded`, `setAllExpanded` | `(dashboard)/journal/show/journal-form.tsx:94` | Both halves of the `useState` are referenced **only** on that line. |
| `fileName` | `admin/import-teachers/teacher-import-form.tsx:19` | `setFileName` **is** called (`:58`), but `fileName` is never read → write-only state. |
| `search` | `api/admin/absensi/route.ts:32` | `searchParams.get('search')` assigned, never applied to `query`. The attendance table has a search box that does not search. |

- **Change risk:** **Low** for the first and third (delete). For `fileName`/`setFileName`,
  either render it or delete both — do not delete the setter alone.

### 5.4 — `handleSort` never sorts · **Medium (user-visible)**

`(dashboard)/export/backup-client.tsx:189-192`:

```ts
const handleSort = () => {
  setSortAsc(!sortAsc)            // toggles a flag …
  addToast('info', `Data diurutkan ${sortAsc ? 'Z-A' : 'A-Z'}`)   // … and claims it sorted
}
```

The toast **lies**. `sortAsc` is used at `:51` (state), `:191` (toast text) and `:297`
(button label) — nowhere in a sort expression. The button at `:294` is wired to `handleSort`.

- **What breaks:** the backup table's A–Z / Z–A control reports success while leaving the
  row order untouched.
- **Change risk:** **Low.** Implement the sort, or remove the button. **Do not leave it** —
  a control that lies about a data operation is worse than no control.

### 5.5 — Unused imports, some with live side-effects · **Low**

| Import | Location | Refs in file |
|---|---|---|
| `Swal` | `(dashboard)/journal/show/journal-form.tsx:16` | **0** |
| `Swal` | `(dashboard)/profile/profile-form.tsx:5` | **0** |
| `Flatpickr` | `src/components/attendance-grid.tsx:4` | **1** (the import itself) |
| `useEffect` ×2 | `(dashboard)/journal/show/journal-form.tsx`, `profile-form.tsx` | 0 |

`attendance-grid.tsx` is the interesting one — the value import is dead but two
**side-effect imports are still bundled**:

```
src/components/attendance-grid.tsx:4   import Flatpickr from 'flatpickr'          ← unused
src/components/attendance-grid.tsx:5   import 'flatpickr/dist/themes/airbnb.css'  ← still shipped
src/components/attendance-grid.tsx:6   import 'flatpickr/dist/l10n/id.js'        ← still shipped
```

- **Change risk:** **Low**, but `layout.tsx:52,88,93` *also* loads Flatpickr from a CDN —
  so the npm copy in `attendance-grid.tsx` is a **duplicate second delivery** of a library
  the page already loads globally. Removing lines 4-6 removes both the dead import and a
  redundant CSS/JS payload. Verify no other component depends on those side effects
  (`kbm-editor.tsx:4-6` and `journal-form.tsx:13-15` import them and *do* use Flatpickr).

### 5.6 — `selectedSheet` is inert (reported as dead — **partially retracted**) · **Medium**

`admin/import/import-form.tsx:38` declares `selectedSheet`; `:171` binds it as the `<select
value>`. So it **is** referenced — the "unused" claim is retracted. But the server ignores it:
`api/import-students/route.ts:35` iterates `workbook.SheetNames` and imports **every** sheet.

- **What breaks:** choosing a sheet in the UI has no effect on what is imported.
- **Change risk:** **Low.** Either pass `selectedSheet` and filter server-side, or drop the
  control. Deleting the state without reading the server first would hide the bug.

---

## 6. Supabase client misuse

### 6.1 — 15 privileged `auth.admin.*` calls on the **publishable** key · **High**

| File | Lines |
|---|---|
| `api/admin/teachers/route.ts` | 80, 103 |
| `api/admin/teachers/[id]/route.ts` | 96, 108, 156 |
| `api/admin/import-teachers/route.ts` | 264, 271, 275, 347, 350 |
| `api/schedule/import/route.ts` | 210, 217, 221, 256, 259 |

Every one of these runs on the client returned by `createClient()`, which is built from
`process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`src/utils/supabase/server.ts:5`).
`auth.admin.*` requires the **service-role** key.

> **I could not confirm at runtime what the live deployment returns.** The publishable key is
> anon-scoped, so the expected outcome is a 401/403 from Supabase on every call — but that is
> inference from the RLS model, not an observed response. Confirm against a running instance
> before assuming the feature is fully broken; some of these calls are inside `if` branches
> that may never execute.

`createServiceClient` **exists** (`server.ts:24`) and is correct — but its only 3 callers are
the broken handlers in §8.6.

- **What breaks:** teacher creation, password reset, deletion and schedule import all depend
  on privileged auth calls made with a key that cannot perform them.
- **Change risk:** **Medium.** Swapping in `createServiceClient()` is a one-line change per
  file, but it **escalates privilege to bypass RLS** — re-verify each of the 15 sites is
  genuinely admin-gated first (they inherit the 34-copy preamble, so most are; confirm the
  ones in `schedule/import`).

### 6.2 — `createServiceClient` has an empty cookie adapter · **High**

```ts
export const createServiceClient = () => {
  return createServerClient(supabaseUrl!, supabaseServiceRoleKey!, {
    cookies: { getAll() { return [] } },        // ← server.ts:30-32, no setAll at all
  })
}
```

`getAll()` returns `[]`, so the client holds **no session cookies**. It is only valid for
anonymous/service operations. Its 3 callers all immediately call `auth.getUser()`.

- **What breaks:** see §8.6 — those 3 handlers return 401 unconditionally.
- **Change risk:** **Low** once you stop calling `auth.getUser()` on it. Fix §6.1 and §8.6
  together; they are the same mistake.

### 6.3 — `listUsers()` inside a per-row loop, default page size · **Medium**

```
api/admin/import-teachers/route.ts:264   const { data: existingUsers } = await supabase.auth.admin.listUsers()
api/schedule/import/route.ts:210          const { data: existingUsers } = await supabase.auth.admin.listUsers()
```

Both sit inside `for (const row of rows)` (the first at `:251`). `listUsers()` with no
argument returns **page 1 only** (50 users by default).

- **What breaks:** once the school exceeds 50 accounts, `existingUser` is never found for
  existing teachers, so `createUser` runs for a user who already exists → duplicate/error per
  row, plus one full user-list fetch **per row**. Both a correctness and an O(rows × 50)
  performance problem.
- **Change risk:** **Low.** Fetch the list **once** before the loop into a `Map`, and page
  through it. Do this together with §6.1.

### 6.4 — Hardcoded shared password · **High**

```
api/schedule/import/route.ts:218    password: 'abbs2024',   // updateUserById — resets existing
api/schedule/import/route.ts:223    password: 'abbs2024',   // createUser — new account
```

Schedule import **resets every imported teacher's password to a string in the source**. It is
identical for all accounts and lives in git.

- **What breaks:** any teacher imported this way has a publicly-known password until they
  change it.
- **Change risk:** **Medium.** Removing the reset changes import behaviour for anyone
  relying on it. Rotate the value and force a reset-on-first-login rather than deleting it
  outright — and treat this as a credential incident, not a cleanup item.

### 6.5 — The SQL `is_admin()` function is never used · **Dead**

`supabase/schema.sql:269` defines `is_admin()`. `grep -rn "is_admin()"` across `src/` returns
**nothing** — every check is a hand-rolled two-step `select('is_admin').eq('id', user.id)`
(34 copies, §1.1).

- **What breaks:** nothing. It is the DB-side expression the whole app reimplements in TS.
- **Change risk:** **Low**, but this is the natural target for §1.1 — a `requireAdmin()`
  helper can call `is_admin()` once instead of issuing the query 34 times.

---

## 7. Laravel-migration residue

### 7.1 — Auth ceremony is copy-pasted from the Laravel middleware · **Low · 36 + 20 sites**

| Marker | Count |
|---|---|
| `{ error: 'Unauthorized' }` | **48** |
| `{ error: 'Forbidden' }` | **40** |
| `supabase.auth.getUser()` | **73** |
| `src/types/index.ts` — *"Auto-generated from legacy Laravel models"* (`:3`) | 1 orphan file |

Explicit Laravel references surviving in the port:

```
src/types/index.ts:3          * Auto-generated from legacy Laravel models
src/lib/v94-parser.ts:5       * Ported from Laravel app/Http/Controllers/Teacher/ScheduleController.php
middleware.ts:36              // Matches Laravel route middleware: auth + admin where applicable
middleware.ts:63              // Admin-only routes - matches Laravel AdminMiddleware
```

`'Unauthorized'` / `'Forbidden'` are the Laravel exception-default messages; the rest of the
API is Indonesian. `middleware.ts:36` and `:63` document that the route lists were hand-ported
from `routes/web.php` + `AdminMiddleware`, which is why `/backup` survives as dead config (§1.5).

- **Change risk:** **Low.** Replace with Indonesian strings *only if* the UI actually surfaces
  them — check the toast layer first; changing them has no effect if the client discards the
  body.

### 7.2 — 64 silent catch blocks vs 40 bound · **Medium**

```
api/…            } catch {            →  return 500 'Terjadi kesalahan server'
api/…            } catch (error) {    →  return 500 error.message
```

Counts: `} catch {` = **64**, `catch (e|err|error)` = **40**.

- **What breaks:** 64 handlers discard the exception entirely. Combined with §8.4, the
  `month`/`year` errors are caught and flattened into a generic 500 — which is precisely why
  the bug has no visible symptom in the UI. Nothing is logged, so these failures are invisible
  in production.
- **Change risk:** **Low.** Bind the error and `console.error` it. Do **not** return it to the
  client — that is §7.3.

### 7.3 — 33 raw driver messages returned to the client · **Medium**

```
api/admin/student/route.ts:52,107,151          { error: error.message }
api/admin/absensi/route.ts:57,114,161          { error: error.message }
… 33 sites in total
```

`error` here is a Supabase/Postgres error. These pass **raw English Postgres text** straight
into a UI that is otherwise Indonesian — e.g. `column "absensis.month" does not exist` (§8.3).
It also leaks schema detail (table and column names) to the browser.

- **Change risk:** **Low.** Log the driver message server-side, return a stable Indonesian
  string. Safe because no client branches on the text — verified: call sites only read
  `response.ok`.

### 7.4 — English strings mixed into Indonesian copy · **Low**

| Literal | Sites |
|---|---|
| `'Method not allowed'` | **7** — `auth/login:60`, `auth/logout:33`, `import-students:84`, `schedule/preview:61`, `profile:70`, `profile/password:79` |
| `'Invalid type'` | **1** — `export/route.ts:107` |

Against ~61 Indonesian `error:` literals in the same routes. **8 English outliers.**
`'Terjadi kesalahan server'` appears 39 times and is Indonesian — an earlier automated pass
misclassified it as English.

- **Change risk:** **Low.**

### 7.5 — 2 unimplemented stubs behind a success response · **Medium**

```
api/export/delete-all/route.ts:41-45
api/export/delete-by-period/route.ts:53-57
    if (with_image === 1) {
      // Note: In a real implementation, you would also delete physical files
      // This requires access to the filesystem which is limited in serverless
      console.log('Image deletion requested but not implemented in serverless environment')
    }
    return NextResponse.json({ success: true, message: '…berhasil dihapus' })
```

**These branches are reachable.** The client sends numeric `1`:
`export/backup-client.tsx:214` (`with_image: deleteType === 'all' ? 1 : 0`) and `:236`.
`console.log` writes to the serverless log, which no user reads.

- **What breaks:** the user ticks "also delete photos", gets *"berhasil dihapus"*, and every
  photo remains in the `uploads` bucket. Silent storage leak with a false confirmation.
- **Change risk:** **Low** to be honest (`"foto tidak dihapus"`), **Medium** to actually
  implement — it needs `supabase.storage.from('uploads').remove([...])` keyed on `absensis.foto`.

### 7.6 — Three conventions for the same flag · **Low**

| Site | Convention |
|---|---|
| `api/admin/absensi/delete-all:28` | `searchParams.get('with_image') === '1'` — **string** |
| `api/admin/absensi/delete-by-period:28,43` | JSON body, **truthy** check |
| `api/export/delete-all:29,41` / `delete-by-period:29,53` | JSON body, `=== 1` — **numeric** |

All three currently work because each client happens to send the matching type. One wrong
client edit silently turns image deletion off — with the false success of §7.5.

- **Change risk:** **Low.** Normalise to `Boolean` in one shared helper.

---

## 8. Correctness bugs

Ordered by severity. Each has been re-verified against the working tree at the snapshot time.

### 8.1 — `Swal.setDefaults` is `undefined`; the admin dashboard throws on mount · **Critical**

`src/components/ui/swal-theme.ts:31-33`:

```ts
const setDefaults = (
  Swal as unknown as { setDefaults: (options: Record<string, unknown>) => void }
).setDefaults.bind(Swal)          // ← throws here
```

Runtime probe against the installed library:

```console
$ node -e "const S=require('sweetalert2');console.log(typeof S.setDefaults)"
undefined
$ node -p "require('sweetalert2/package.json').version"
11.26.25
```

`setDefaults` is **not exported** by `sweetalert2@11.26.25`. The cast exists only to silence
TypeScript — and it works: **`npx tsc --noEmit` is currently clean**, which is precisely the
hazard. At runtime `undefined.bind(...)` throws `TypeError: Cannot read properties of
undefined (reading 'bind')`.

Call path: `src/app/admin/dashboard-client.tsx:68` calls `useSwalTheme()` **unconditionally**
in the component body; `useSwalTheme` → `React.useEffect` → `applySwalTheme()` →
`setDefaults({...})`.

**There is no error boundary anywhere in `src/`.** Verified by filesystem sweep — no
`error.tsx`, no `global-error.tsx`, no `not-found.tsx`, no `loading.tsx`:

```console
$ find src \( -name 'error.tsx' -o -name 'global-error.tsx' -o -name 'not-found.tsx' -o -name 'loading.tsx' \)
(no results)
```

`src/app/error/page.tsx` is **not** a boundary — it is a normal navigable route (it awaits
`searchParams` and calls `cookies()`).

- **What breaks:** the `/admin` dashboard crashes on every mount for every admin. There is no
  boundary to catch it, so the user sees the framework's unstyled crash screen.
- **Change risk:** **Low** for the immediate fix — use `Swal.mixin()` (present in the runtime
  key list) or the documented `Swal.bindThis`/instance options instead of `setDefaults`.
  **Low** for adding `src/app/error.tsx` + `global-error.tsx` — additive, no existing behaviour
  changes.
- **Note:** an earlier pass reported this as a `tsc` error at `swal-theme.ts:29`. That is now
  stale — the cast was added during this refactor. The *runtime* bug is unchanged and was
  re-probed at snapshot time.

### 8.2 — `POST /api/import-students` has no admin check · **High (security)**

`src/app/api/import-students/route.ts:14-16` is the **only** gate:

```ts
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

No `is_admin` check follows. It then parses an uploaded workbook and writes to `students`:

```
route.ts:51-57   await supabase.from('students').upsert({ name, grade }, { onConflict: 'name,grade' })
```

- **What breaks:** **any authenticated teacher** can bulk-insert or overwrite rows in
  `students`. The upsert's conflict target is genuinely valid
  (`supabase/schema.sql:35` — `CREATE UNIQUE INDEX … ON public.students(name, grade)`), so this
  is a real, working write. The page at `admin/import/page.tsx:30` redirects non-admins, but
  that is a client-side redirect; the endpoint is directly reachable.
- **Change risk:** **Low.** Add the `is_admin` guard (copy the 34-copy preamble), or better,
  route it through the `requireAdmin` helper from §1.1. Purely additive.
- **Also flagged, *not* confirmed:** `api/admin/import-teachers` **does** gate on `is_admin`,
  so the asymmetry is almost certainly an oversight rather than a deliberate
  teacher-facing feature. I could not find a product reason for the difference.

### 8.3 — Filtering `absensis` on columns that do not exist · **High (data)**

`supabase/schema.sql:40-53` — the complete `absensis` table:

```sql
CREATE TABLE IF NOT EXISTS public.absensis (
  id BIGSERIAL PRIMARY KEY, user_id UUID …, nama TEXT NOT NULL, unit …, lokasi …,
  alamat TEXT, foto TEXT, akurasi TEXT, waktu TIMESTAMPTZ NOT NULL,
  value CHAR(1) CHECK (value IN ('S','I','A')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at … NOT NULL
);
```

There is **no `month` and no `year` column**. Four call sites filter on them anyway:

```
api/admin/absensi/route.ts:43            query = query.eq('year',  Number(year))
api/admin/absensi/route.ts:47            query = query.eq('month', Number(month))
api/admin/absensi/delete-by-period/route.ts:40,41   .eq('month', month).eq('year', year)
api/admin/absensi/delete-by-period/route.ts:56,57   .eq('month', month).eq('year', year)
```

- **What breaks:** Postgres **42703 column does not exist** → the handler's `} catch {`
  swallows it (§7.2) → **500 with `'Terjadi kesalahan server'`**. The client sends both params
  (`absensi-client.tsx:134` builds `?${params}`), so the branch is taken whenever a period is
  selected. `delete-by-period` is worse: it filters before deleting, so **period deletion
  silently fails after appearing to succeed**.
  `absensis` carries `waktu TIMESTAMPTZ`, so the correct filter is a `waktu` range.
- **Change risk:** **Medium** — the fix is obvious but changes which rows match. Once a real
  range filter lands, re-verify the delete-all and period-delete scopes against production data
  before enabling them for admins.

### 8.4 — Attendance records are written without `value`; reports default to "izin" · **High (data)**

The insert at `api/absensi/route.ts:126-134` omits `value`:

```ts
const { error: insertError } = await supabase.from('absensis').insert({
  user_id: user.id, nama: profile.name, unit: 'SMP ABBS Surakarta',
  lokasi, alamat, foto: urlData.publicUrl, waktu: new Date().toISOString(),
})                                        // ← no `value`
```

`value` is nullable with no default, so every check-in row stores `NULL`.

The report then reads it at `api/export/export-waktu/route.ts:86`:

```ts
const value = record?.value || 'A'
if (value === 'S') total++
else if (value === 'I') total += 0.5
```

- **What breaks:** `NULL || 'A'` ⇒ **`'A'` (izin / absent)** for every teacher, every day.
  `total` never counts a `S`, so the waktu export reports **0 present / full absence for
  everyone, permanently** — regardless of what actually happened. Any UI that filters on
  `value` sees the same.
- **Change risk:** **Medium-High.** Adding `value` to the insert fixes new rows but does
  **not** repair existing rows, which are already `NULL`. Needs a backfill decision
  (default them to `'S'` where a photo + coordinates were captured, or mark them
  "unrecorded"). Backfill before switching on the report.

### 8.5 — `PUT /api/admin/absensi/[id]` returns 405 · **High (feature down)**

See §2.3 for the call-graph evidence.

```
client   absensi-client.tsx:291-292   fetch(`/api/admin/absensi/${id}`, { method: 'PUT', … })
route    api/admin/absensi/[id]/route.ts:5   export async function DELETE(   ← no PUT handler
```

- **What breaks:** `saveInlineEdit()` (`absensi-client.tsx:284`) fails for every cell. The
  admin attendance grid cannot be edited at all.
- **Change risk:** **Medium.** Do **not** add `PUT` on `[id]` by copying `admin/absensi`'s
  PUT — that handler has a mass-assignment hole (§8.9). Write an allow-listed version:
  pick the one editable field (`value`, validated against the `CHECK` constraint
  `('S','I','A')` from `schema.sql:50`), and nothing else.

### 8.6 — All 3 handlers on `api/schedule/[id]` are permanently 401 · **Medium**

`api/schedule/[id]/route.ts:10`, `:55`, `:113` each begin:

```ts
const supabase = createServiceClient()          // cookie adapter returns []  (server.ts:30)
const { data: { user } } = await supabase.auth.getUser()
if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
```

`createServiceClient` deliberately returns **no cookies** (§6.2), so `auth.getUser()` can only
ever see `null`. Every one of `GET`(`:4`), `PUT`(`:49`), `DELETE`(`:107`) is unreachable.

This is why the sweep reports the whole file as uncalled (§2.1) — it is **not** merely
unreferenced, it is **non-functional**.

- **What breaks:** nothing observable — no client calls it (§2.1). But the file looks like a
  working CRUD endpoint and is 100% dead weight with a live-looking auth block.
- **Change risk:** **Low.** Delete the file. If schedule editing is genuinely wanted, rebuild
  it on `createClient()` (cookie-backed) like every other route.

### 8.7 — Image deletion is faked behind a success message · **Medium**

See §7.5. Reachable, returns `success: true`, deletes nothing, logs to a place nobody reads.

### 8.8 — The explorer UI targets routes that do not exist · **Medium**

`src/app/api/explorer/*` — 5 routes, **all with zero callers** (§2.1). But the UI *tries* to
reach them, via `<form>` actions that point at **page** paths, not `/api` paths:

```
(dashboard)/explorer/page.tsx:88    <form action={`/explorer?path=${currentPath}`} method="GET">
(dashboard)/explorer/page.tsx:100   formAction="/explorer/folder"
(dashboard)/explorer/page.tsx:107   <form action={`/explorer?path=${…}`} method="GET" encType="multipart/form-data">
(dashboard)/explorer/page.tsx:117   formAction="/explorer/upload"
(dashboard)/explorer/page.tsx:174   <form action={`/explorer/delete-${…}?path=${…}`} method="POST">
```

There is **no** `src/app/(dashboard)/explorer/folder`, `/upload`, `/delete-file` or
`/delete-folder` page — only `page.tsx` and `codemap.md`. So the browser navigates to 404s.
Worse, `:107` attempts a **file upload over GET**, which cannot carry a body.

Even if the paths were corrected, every handler reads JSON while the browser would send form
encoding:

```
api/explorer/delete-file/route.ts:28    const { path } = await request.json()
api/explorer/delete-folder/route.ts:28   const { path } = await request.json()
api/explorer/folder/route.ts:28          const { path, newFolder } = await request.json()
api/explorer/rename/route.ts:28          const { oldPath, newName } = await request.json()
```

And the verbs disagree with the form methods: the UI POSTs to `/delete-file` and
`/delete-folder`, while both routes export `DELETE` only.

- **What breaks:** all 5 explorer features (create folder, upload, rename, delete file,
  delete folder) are non-functional. Combined with §2.1 the whole explorer subsystem is
  dead UI wired to dead API.
- **Change risk:** **Low** to delete (remove the page + the 5 routes), **Medium** to fix
  (rewrite as `onSubmit` + `fetch` with JSON, and align verbs — the UI POSTs where the routes
  export `DELETE`). Note `src/components/ui/dropzone.tsx` was briefly the natural fit here,
  but it is now wired to both import forms (§5.1) and should not be reused.

### 8.9 — Mass assignment on `PUT /api/admin/absensi` · **Medium**

`api/admin/absensi/route.ts:149-158`:

```ts
const { id, ...updates } = await request.json()
if (!id) { return …400 }
const { error } = await supabase.from('absensis').update(updates).eq('id', id)
```

`updates` is **whatever the client sent**. An admin can write `user_id`, `nama`, `waktu`,
`created_at`, or every column at once.

- **What breaks:** nothing today — **this handler has no caller** (§2.2), so it is dead *and*
  dangerous. That is the saving grace, and the reason not to wire it up while fixing §8.5.
- **Change risk:** **Low** to delete (it is dead). If kept, allow-list exactly one writable
  column and validate it against the `CHECK` constraint.

### 8.10 — `listUsers()` per row, default page · **Medium**

See §6.3.

---

## 9. Retracted and corrected claims

Recorded because they were investigated and **did not hold up**. Do not re-investigate these.

| Claim | Verdict | Evidence |
|---|---|---|
| `summaryMap` is an unused local | **FALSE** | Used — `journal/show/page.tsx:174,177,187`, passed as a prop at `journal-form.tsx:594`. |
| `gridData` is an unused local | **FALSE** | Used — `export/backup-client.tsx:47` (state), `:166`, `:328`. |
| `adminsCount` is an unused local | **FALSE — already fixed** | Used — `admin/page.tsx:63,140,187` → `dashboard-client.tsx:339`. *(It genuinely was dead at 19:50; the concurrent editor fixed it at 19:58.)* |
| `selectedSheet` is unused | **PARTLY FALSE** | Referenced at `import-form.tsx:171`. Refuted as "unused" but **kept as a real bug** (§5.6): the server ignores it. |
| `min-vh-100` is used 21× but defined 0× | **FALSE** | `min-vh-100` comes from **Bootstrap 5.2.3**, loaded at `src/app/layout.tsx:52`. `globals.css` is not the only stylesheet. *(Current count: 17 uses.)* |
| `['7','8','9'].includes(grade)` is always false | **FALSE** | `grade` is `?class=`. The `<select>` at `journal/page.tsx:98-115` emits a bare `value={grade}` for Leadership classes, so `class=7` **is** submitted and the branch fires correctly. Retracted; kept as duplication only (§4.6). |
| `LEADERSHIP_CLASS_MARKER` is in `v94-parser.ts` | **WRONG FILE** | `src/lib/bell-schedule.ts:47`. |
| `uniqueDates` is an unused local in `absensi-client.tsx:122` | **GONE** | Removed by the concurrent editor during the audit. Do not re-report. |
| Teacher tables are "~90% identical" | **OVERSTATED** | Measured 68.2% sequence similarity / 64% identifier Jaccard (§4.3). |
| The 34 identical preambles span 19 files | **WRONG COUNT** | 34 copies across **27** files (§1.1). |
| `table-responsive-wrapper` is orphaned CSS | **RESOLVED** | 0 uses and 0 definitions — the class is already gone. |
| `swal-theme.ts:29` is a `tsc` error | **STALE** | The cast at `:31-33` silenced it; `npx tsc --noEmit` is clean. The **runtime** bug is real and re-probed (§8.1). |
| `export`, `export-lokasi`, `export-waktu`, `journal/export` are uncalled | **FALSE** | Reached by `href=` (`export/page.tsx:230,223,217`) and `window.open()` (`journal-form.tsx:314`), not `fetch()`. |
| `logout-button.tsx` and `ui/dropzone.tsx` are orphaned | **TRUE at 20:14, then INVALIDATED** | `navbar.tsx` was deleted and recreated (mtime 20:20) mid-audit. Both files now have importers — `navbar.tsx:20`, `import-form.tsx:13`, `teacher-import-form.tsx:14`. Corrected in §5.1. |

**Working-tree drift after the snapshot.** The tree kept moving while this document was
written. Between 20:14 and 20:20 the concurrent refactor deleted and recreated
`src/components/navbar.tsx`, which invalidated one §5 claim (corrected inline) and took
`npx tsc --noEmit` from **clean** to **1 error**
(`src/app/(dashboard)/layout.tsx(1,20): Cannot find module '@/components/navbar'` during the
window in which the file did not exist). Re-run the appendix commands before acting on any
count in this document; treat the *findings* as durable and the *line numbers* as
snapshot-bound.

**Two unresolved items — I could not confirm either way:**

1. `api/journal/save-all` and `api/journal/save-note` have no `is_admin` guard. That may be
   correct (owner-scoped writes) or a vulnerability. Reading the ownership predicate is a
   10-minute check and is deliberately left open rather than guessed.
2. §6.1 — whether `auth.admin.*` on the publishable key fails at runtime. The RLS model says
   it must; only a live request proves it.

---

## 10. Order of work

Grouped so **each block ships independently** — every boundary below is a separate commit
that can be reverted on its own. Cheapest and safest first.

### Block 1 — Delete dead weight · *no behaviour change · ~1 hour · risk: Low*

Nothing here is reachable, so a regression can only come from a caller a grep cannot see.

1. Delete the **13 uncalled route files** (§2.1) — with one judgement call: confirm
   `export/pdf/*` against external bookmarks first, since GET routes can be linked.
2. Delete the **3 orphan files** (§5.1) — `src/types/index.ts` and both
   `src/components/pdf/*`. ⚠️ **Do not delete `logout-button.tsx` or `ui/dropzone.tsx`** —
   both were orphaned at the snapshot but were re-wired by the concurrent refactor at ~20:20.
3. Delete the **5 dead exports** (§5.2) — *except* `getPeriodDateRange`/`getSemesterMonths`,
   which Block 6 wires up first.
4. Delete the **3 unread locals** (§5.3).
5. Remove the **unused imports** (§5.5) — including `attendance-grid.tsx:4-6`, which also
   drops a duplicate Flatpickr payload.
6. Delete the **2 dead verbs** on `admin/absensi` — `DELETE`(`:69`) and `PUT`(`:126`). This
   retires the mass-assignment hole (§8.9) for free.

> Hold `src/app/api/explorer/*` + `(dashboard)/explorer/page.tsx` (§8.8) until the explorer
> decision in Block 8 — deleting the page and the routes together is one clean commit.

### Block 2 — Restore the admin dashboard · *fixes Critical · ~30 min · risk: Low*

7. Fix `swal-theme.ts:31-33` — `Swal.mixin()` or instance options; `setDefaults` does not
   exist in `sweetalert2@11.26.25` (§8.1).
8. Add `src/app/error.tsx` + `src/app/global-error.tsx` (§8.1). **Ship with Block 7** — a fix
   without a boundary leaves the next crash just as invisible. This is the only place where
   the "cheapest first" ordering is deliberately broken: this is the app's one live crash.
9. Verify `/admin` mounts. Because there is no test suite, add the boundary *and* smoke-test
   the dashboard in the same commit.

### Block 3 — Extract the auth guard · *kills 56 copies · ~2 hours · risk: Low, compiler-guarded*

10. Add `requireAdmin(supabase, user)` / `withAdmin(handler)` to `src/utils/supabase/server.ts`.
11. Replace all **36** API preambles (§1.1) and the **20** RSC gates (§1.2).
12. Add the missing `is_admin` guard to **`api/import-students`** (§8.2) — do this in the same
    commit; the helper makes it a one-liner and it is a live security hole.
13. Reconcile `middleware.ts` route lists (§1.5): drop `/backup`, add `/schedule`, delete the
    discarded `getClaims()` at `:31`.

> Blocks 1 and 3 are independent and can be reviewed separately. Block 3's compiler coverage
> is what makes the other 40-copy cleanups cheap later.

### Block 4 — Supabase correctness · *fixes High · ~3 hours · risk: Medium*

14. Route the **15 `auth.admin.*` sites** (§6.1) through `createServiceClient()`, re-verifying
    admin-gating at each. **Read the §9 open item first** — confirm against a live instance
    whether these currently fail.
15. **Fix `listUsers()` in loops** (§6.3): one fetch before the loop, into a `Map`.
16. **Handle the hardcoded password** (`schedule/import:218,223`, §6.4) as a credential
    incident, not a cleanup — rotate, force reset-on-first-login. Highest-urgency item in
    this block despite its small diff.

### Block 5 — Attendance data integrity · *fixes High · ~4 hours · risk: Medium-High*

17. **Backfill `absensis.value`** (§8.4) — decide and ship the backfill **before** enabling
    the report. Without it the export is permanently wrong.
18. Write `value` on insert (`api/absensi/route.ts:126-134`).
19. **Replace the `month`/`year` filters** with `waktu` ranges (§8.3) at all 6 call sites;
    verify delete scopes against real data first.
20. **Add `PUT` to `api/admin/absensi/[id]`** (§8.5) with an **allow-listed** column —
    *not* a copy of the collection handler's `...updates`.
21. Implement or disclose image deletion (§7.5, §8.7). Do not leave the false success.

### Block 6 — Database constraints · *fixes High · ~1 hour + migration · risk: Medium*

22. Add missing unique indexes so the existing upserts work:
    - `notes` — `api/journal/save-all/route.ts:43,71` and `api/journal/save-note/route.ts:37`
      all upsert on `class,subject,date`. `schema.sql:92` is a plain `CREATE INDEX`.
      → **currently every journal save fails with 42P10.** ⚠️ **Verify this first — if true,
      the journal is fully broken and belongs in Block 2's severity tier.**
    - `schedules` — `api/schedule/import/route.ts:132` upserts on `class_name,day,period`.
      `schema.sql:111` indexes only `(class_name, day)`.
23. ⚠️ **Design flag:** the `notes` conflict target omits `teacher_id` and `time`. A unique
    index on `(class,subject,date)` alone would make two teachers on the same
    class/subject/date **collide**. Settle the intended key before writing the migration —
    this is the one item where "just add the index" is likely wrong.
24. Only `students` (`:35`) and `attendances` (`:73`) have real unique indexes today.

### Block 7 — Stop lying to users · *~2 hours · risk: Low*

25. Fix `handleSort` (§5.4) — implement it or delete the button. A control that toasts success
    while doing nothing is worse than an absent one.
26. Honour `selectedSheet` server-side (§5.6).
27. Normalise `with_image` to one convention (§7.6).
28. Indonesian-ise the 8 English literals (§7.4).
29. Bind the **64 silent catches** and `console.error` them (§7.2) — server-side only; do not
    return driver text to the client.

### Block 8 — Decide, then consolidate · *refactor · ~1 day · risk: Medium*

Deliberately last: every item below is a *product* decision, and none of them is blocking.

30. **Explorer**: delete page + 5 routes, or rebuild (§8.8). 31. **Teacher tables**: merge
    `user-table` / `teacher-table` / `ts-manager-client` (§4.3) — ~1,580 lines, all three
    live. 32. **Period math** onto `period-system.ts` (§4.4, §4.5) — 5 sites, 2 key formats.
33. **Deduplicate**: PDF styles (§4.1), class-grouping block (§4.2), `ilike` scope (§4.6).
34. **Stop leaking driver messages** to the client (§7.3) — 33 sites.

---

## Appendix — reproducing this inventory

```bash
# 1 · Critical runtime bug
node -e "const S=require('sweetalert2');console.log(typeof S.setDefaults)"   # undefined
npx tsc --noEmit                                                             # clean — the cast hides it
find src \( -name 'error.tsx' -o -name 'global-error.tsx' \)                  # empty

# 2 · The 36 auth preambles (§1.1)
#    extract `const cookieStore = await cookies()` … `status: 403 })` and group by MD5

# 3 · Uncalled endpoints (§2) — must capture fetch AND href AND window.open
#    longest-match wins, so /api/export does not shadow /api/export/backup-save

# 4 · Unique indexes (§8) — the whole list
grep -n "UNIQUE\|PRIMARY KEY" supabase/schema.sql

# 5 · Byte-identical blocks (§4.1, §4.2) — MD5 the extracted ranges
```

**Standing caveat.** There is no test suite, so none of the above is regression-protected. The
first block of work should add one. Until then, grep/hash evidence is the only verification
available, and this inventory should be re-run — not trusted — after each block lands.
