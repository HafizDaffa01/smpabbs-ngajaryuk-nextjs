# src/app/(dashboard)/prevSmes/

## Responsibility

The **semester recap dispatcher**. Like `/journal`, this page contains no data grid — it derives the class list from `schedules` and offers two independent entry points, each a plain HTML GET form pointing at a different recap view:

| Card | Icon | Form action | Destination page | Content |
|---|---|---|---|---|
| **Rekap KBM** | `ChartColumnBig` | `/prevSmes/show` | `prevSmes/show/page.tsx` | KBM notes grouped by date + per-day student absence list |
| **Rekap Presensi Siswa** | `ClipboardList` | `/prevSmes/presensi` | `presensi/page.tsx` | semester/monthly attendance matrix per student |

Single file: `page.tsx` — Async Server Component, 193 lines, exports `metadata` and default `RekapSelectPage`.

## Design

### Server data pipeline

Identical in shape to `(dashboard)/journal/page.tsx`, with one difference:

1. `await cookies()` → `createClient(cookieStore)`.
2. `auth.getUser()` → `redirect('/login')` if `!user`. **No profile-existence probe** — unlike `/journal`, there is no second `profiles` query, so a user without a profile row reaches the picker.
3. `supabase.from('schedules').select('class_name').order('class_name')` — again the entire schedule table, deduped with `new Set`, grouped by `c.charAt(0)` (grade) / `c.slice(1)` (sub-class), each bucket sorted.

### Render

- Container: `flex flex-col gap-5 bg-surface-canvas text-text-primary`, opening with a `PageHeader` (title "Rekap Semester", breadcrumb `Beranda` → `/`, `actions` = `Badge` with the current period from `getCurrentPeriod().label`). Cards sit in `grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2`.
- Both cards are rendered from a single `recaps: RecapKind[]` array; each is **its own `<form>`**, so the whole card is the click target:

```tsx
<form action={recap.action} method="GET" className="flex">
  <input type="hidden" name="usr" value={user.id} />
  <Card className="flex w-full flex-col"> … Field/Select + Button … </Card>
</form>
```

- Card shell: `CardHeader` with a `size-11` icon tile (`aria-hidden`, `rounded-md`, border + tone classes from `recap.iconTone`), then `CardTitle` + `CardDescription`; `CardContent` holds the field and a full-width `Button size="lg"` labelled `Lihat Rekap`.
- **Rekap KBM card** (`id: 'classKbm'`, action `/prevSmes/show`): lucide `ChartColumnBig`, `iconTone: 'border-success-border bg-success-bg text-success-text'`, title `Rekap KBM`, description *"Pilih kelas untuk melihat rekapitulasi KBM selama 1 semester"*.
- **Rekap Presensi card** (`id: 'classPresensi'`, action `/prevSmes/presensi`): lucide `ClipboardList`, `iconTone: 'border-info-border bg-info-bg text-info-text'`, title `Rekap Presensi Siswa`, description *"Pilih kelas untuk melihat rekapitulasi presensi siswa selama 1 semester"*.
- Both cards share one `<Field id={recap.id} label="Pilih Kelas" required>` + `<Select name="class" required defaultValue="">` body, so the class option list is identical on both. When `gradeGroups.length === 0`, each card renders an `EmptyState` ("Belum ada kelas", with a `ButtonLink` to `/schedule`) instead of the form controls.

### Class-name normalisation (mirrors `(dashboard)/journal/page.tsx`)

| Rule | Effect |
|---|---|
| `.filter(([grade]) => !['0','k','a'].includes(grade))` | drops grade buckets `'0'`, `'k'`, `'a'` |
| `/^\d+$/.test(full)` → `Leadership Class ${full}` | purely-numeric class names are relabelled |
| `grade in ['7','8','9'] && subs.length === 0` | injects `Leadership Class <grade>` |

**Known quirk (still present):** both cards render the same class list, and inside it the Leadership injection is written as ``grade in ['7','8','9'] && subs.length === 0``. `in` tests array *indices*, so that branch never fires — only the ``/^\d+$/.test(full)`` relabelling below produces "Leadership Class" options. The source carries an explicit comment saying this is preserved verbatim.

Neither form sends `semester`, `year`, `view`, `month`, or `date` — every one of those is defaulted inside the destination pages from the current date. `usr` is carried as a hidden field purely for symmetry with `/journal`.

## Data Flow

```
Browser ──GET /prevSmes─────────────────────────────────────────►
        ◄── two plain GET forms (no fetch, no client JS)
Browser ──GET /prevSmes/show?class=7A&usr=<uuid>────────────────► full page nav
Browser ──GET /prevSmes/presensi?class=7A&usr=<uuid>───────────► full page nav
```

No API routes are involved; both destinations re-read `students`, `attendances` and `notes` server-side. `schedules.class_name` is the only read in this page.

## Integration Points

- **Auth:** `/prevSmes` is in `middleware.ts`'s `protectedRoutes`, so unauthenticated visits are redirected to `/login?redirect=/prevSmes`; the page repeats the `auth.getUser()` guard server-side.
- **Layout:** the route lives under the `(dashboard)` group (`src/app/(dashboard)/prevSmes/`), so it renders inside `(dashboard)/layout.tsx` → `TeacherShell` → `AppShell` → `TeacherNav` plus `Scripts`. The old claim that it was a sibling rendering the root layout only no longer holds; the old `src/components/navbar.tsx` / `mobile-nav.tsx` components were deleted in the DS v2 migration.
- **Sibling destination pages:** `/prevSmes/show/page.tsx` (KBM recap, `dynamic = 'force-dynamic'`, `view=semester|daily`) and `/prevSmes/presensi/page.tsx` (attendance matrix, also `dynamic = 'force-dynamic'`, `view=semester|monthly`).
- **Tables:** `schedules.class_name` only.
- **Shared code:** the class-grouping block is duplicated between this page, `(dashboard)/journal/page.tsx` (which additionally probes `profiles`), and the two `mapelList` builders in `(dashboard)/journal/show/page.tsx`. There is no shared helper for it.
- **Design system:** DS v2 composition — `PageHeader` + `Badge` + `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` + `Field`/`Select` + `Button`/`ButtonLink` + `EmptyState`. The `56rem` two-column emoji-block row described by `docs/brutalist-design-spec.md` §4.8 is historical.
- **RBAC:** nothing here restricts the recap to admins; any authenticated teacher who reaches `/prevSmes/presensi?class=…` can read any class's attendance, because the `attendances` RLS policy is `auth.role() = 'authenticated'`.