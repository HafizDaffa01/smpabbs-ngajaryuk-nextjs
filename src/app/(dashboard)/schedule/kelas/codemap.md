# src/app/(dashboard)/schedule/kelas/

**Route:** `/schedule/kelas` — "Jadwal per Kelas", a per-class weekly timetable.

Row axis = jam pelajaran 1–9, column axis = Senin–Sabtu, for one selected class.
It is the sibling of `/schedule` (per-teacher flat table), and the two
cross-link in both directions through their `PageHeader` actions.

Parent folder map: `src/app/(dashboard)/schedule/codemap.md`.

---

## Files

| File | Kind | Role |
|---|---|---|
| `page.tsx` | RSC | Auth guard, `metadata`, `PageHeader`, local `KelasSkeleton`, owns the `<Suspense>` boundary |
| `kelas-content.tsx` | `'use client'` | Class selector, the 9×6 grid, the "Mapel → Guru" summary, all loading/empty/error states |
| `codemap.md` | doc | This file |

### Why the split

`TeacherShell` is an **async Server Component** (it reads `cookies()`), so a
`'use client'` module cannot import it — this is the same constraint that
forced `schedule/schedule-browser.tsx` to be a separate module. `page.tsx` is
therefore a thin RSC; `KelasContent` is its own module and is imported as a
default export.

`KelasContent` uses `useSearchParams()`, which is what actually requires the
`<Suspense>` wrapper in `page.tsx:67`.

**Do not add `<TeacherShell>` to `page.tsx`.** The `(dashboard)` group layout at
`src/app/(dashboard)/layout.tsx:26` already wraps every child in it — adding it
here reproduces the double-sidebar bug that was fixed across nine other pages.

---

## Data flow

Both requests go through the existing `GET /api/schedule`; no new API route
was added.

1. **Unfiltered pass** (`GET /api/schedule`) → derives the distinct
   `class_name` values, and doubles as the empty-database probe. Runs once on
   mount. If the list is empty the component renders `EmptyState` pointing at
   `/schedule/import` instead of a selector.
2. **Scoped pass** (`GET /api/schedule?class=<X>`) → the selected class's rows.
   Re-runs on every class change.

The pivot happens client-side (`grid` `useMemo`), so switching classes never
re-renders the RSC shell and does not refetch the full table.

Source of truth is the `schedules` table: `class_name`, `day`, `period`,
`subject`, `subject_display`, `teacher`, `start_time`, `end_time`.

### The `Mapel → Guru` summary

Teacher names are deliberately kept **out** of the grid cells and rendered in a
summary card below instead, because a 9×6 cell is too small to hold a subject
*and* a teacher name legibly. The summary groups the selected class's rows by
`subject_display` and collects the unique `teacher` values. Subjects with no
teacher (Homeroom Teacher, Scout, Self Development, Seni Budaya Kesenian) render
"Without guru" — the Indonesian string is "Tanpa guru".

---

## Gotchas

**`day` literals.** Stored values are always capital-first English —
`'Monday'`…`'Saturday'` (`DAY_MAP` in `@/lib/bell-schedule`). There is no
`'Sunday'`. `DAYS` in `kelas-content.tsx` must stay in Monday→Saturday order
because it is the column order.

**Non-existent slots are rendered, not omitted.** The row axis is a fixed 1–9
for every class, so Friday period 6 and Saturday periods 7–9 exist as
explicit "off" cells. The authority is `VALID_LESSONS_BY_DAY` from
`@/lib/bell-schedule`:

- Monday–Thursday: 1–9
- Friday: 1,2,3,4,5,7,8,9 — **period 6 does not exist**; it is consumed by the
  Jumu'ah prayer break (11:10–13:00)
- Saturday: 1–6 only, starting 07:15, 30 minutes per period

Friday's gap exists because the source spreadsheet numbers its post-break
periods 6/7/8 raw, while the school calls them 7/8/9 — the import already
applies `FRIDAY_RAW_TO_DISPLAY`. Do not "fix" the off cells; they are expected
structure, so they are styled quietly (`bg-surface-sunken` + `text-text-disabled`)
rather than as an error.

**Leadership rows use a bare grade digit as `class_name`.** A class named
`'7'` is the whole-grade Leadership meeting for grade 7, not a class code.
`isLeadershipClass()` detects `/^\d$/` and `classLabel()` renders it as
"Leadership 7". `classSortKey()` orders bare digits directly after their
grade's lettered classes.

**Class names are never hardcoded.** Project policy
(`.kilo/skills/v94-import/SKILL.md`) requires reading classes from the data.
Names are `7A`–`9F`; the ICT/TCP/IFE variants are already normalised onto the
base class by the importer, so they never appear as separate classes.

**`teacher` is one comma-joined string.** Team teaching (Quran) packs several
names into a single column, so `splitTeachers()` splits on `,`. Both the grid
cell and the summary render every name — the data model is unchanged.

**A grid slot can hold more than one row.** `schedules` has **no unique
constraint** on `(class_name, day, period)`, so the bucket is an array and each
entry is rendered as its own `<li>`. This also means a duplicate import would
show doubled cells rather than erroring.

**Class selection is URL-driven.** Each change does `router.push()` to
`?class=<X>`, so the view is deep-linkable and back/forward work. On first
mount, if no `class` param is present, the first class is selected
automatically so the view is never a dead end.

---

## Style contract

Design-system primitives from `src/components/ui/`, all token-driven
(`--ds-*`, bridged through the `@theme inline` block in `src/app/globals.css`):

`PageHeader` · `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` ·
`ButtonLink` · `Badge` · `Field` + `Select` · `Table` and its six siblings ·
`EmptyState` · `FeedbackBanner` · `SkeletonTable`

No page scaffolding is added — the teacher shell supplies the canvas and padding.
Icons are `lucide-react` only (`CalendarPlus`, `Clock`, `Table2`, `ArrowLeft`).
No raw hex, no `--dark-*` utilities, no legacy `.card-brutalist*` /
`.btn-brutalist*` / `.form-control` classes.

The grid uses `TableScroll` so it scrolls internally instead of overflowing the
page at 375px, and `min-w-[880px]` on the `Table`. `TableHead` already carries
`sticky top-0 z-10`; the period column adds `left-0` with `z-20` on the corner
cell so the two sticky axes do not overlap.

`focus-ring` / `eyebrow` / `meta` / `prose-block` / `action-row` are scoped to
`[data-ds-shell]`, which `TeacherShell` applies — so they resolve here. They
would **not** resolve on the chrome-free routes (`/login`, `/error`,
`/success`, `/unauthorized`).

---

## States

- **Loading** — `page.tsx` renders `KelasSkeleton` (a header block + card
  placeholder) while `KelasContent` suspends; inside the component,
  `SkeletonTable` covers the class list and the grid.
- **Empty database** — `classes.length === 0` → `EmptyState` "Belum ada kelas"
  with a `ButtonLink` to `/schedule/import`. **This is the current live state**:
  the `schedules` table is empty.
- **Empty class** — `occupiedSlots === 0` → `EmptyState` naming the class.
- **Error** — `FeedbackBanner tone="error"`, dismissible, covering both fetch
  passes.
