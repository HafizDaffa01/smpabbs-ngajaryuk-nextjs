# src/types/

One file, `index.ts` (85 lines), eight `interface` declarations that mirror the
six tables in `supabase/schema.sql`. The header comment says
*"Auto-generated from legacy Laravel models"*.

**The single most important fact about this folder: nothing imports it.**
`grep -rn "@/types" src/` returns zero TypeScript hits. Every page, component
and Route Handler in the app re-declares its own local row type instead. These
interfaces are documentation-as-code, and they have drifted from both the
database and the code that actually runs.

## Responsibility

- Name the shape of the six Supabase tables (`profiles`, `students`, `absensis`,
  `attendances`, `notes`, `schedules`) as TypeScript interfaces.
- Provide two derived helper shapes: `AttendanceSummary` (S/I/A tally) and
  `MapelAssignment` (class → subject list).
- Serve as the nominal contract a future refactor would import — today it is
  unused.

## Design

**Flat, no imports, no runtime.** `src/types/index.ts` has zero `import`
statements and zero runtime code — it is types-only, and it is *not* covered by
`@/utils/supabase`'s `Database` generic (none of the three Supabase clients pass
a schema type, so every `data` is `any` at the boundary anyway). All eight
shapes are `interface`s, all fields are snake_case to match the Postgres
columns, and optionality is expressed as `?` plus `| null` to mirror a nullable
column.

| Interface | Line | Mirrors | Notes |
|---|---|---|---|
| `Profile` | 6 | `profiles` | `mapel?: Record<string, string[]> \| null` |
| `Student` | 16 | `students` | `progul?: string \| null` (odd name, from the Laravel model) |
| `Absensi` | 25 | `absensis` | **missing `value`** (see below) |
| `Attendance` | 39 | `attendances` | `value: 'S' \| 'I' \| 'A'` — correct union |
| `Note` | 50 | `notes` | `teacher_id?: string \| null` |
| `Schedule` | 63 | `schedules` | `start_time?/end_time?: string \| null` |
| `AttendanceSummary` | 77 | — | `{ S: number; I: number; A: number }` |
| `MapelAssignment` | 83 | `profiles.mapel` | `{ [className: string]: string[] }` |

**The duplication that replaced this folder.** Ten files declare their own local
row types with the same names and different fields:

| File | Local type | Diverges from `src/types` how |
|---|---|---|
| `src/app/profile/profile-form.tsx:8` | `Profile` | drops `mapel`, `created_at`, `updated_at` |
| `src/app/journal/show/page.tsx:7` | `Note` | drops `created_at`/`updated_at` |
| `src/app/journal/show/journal-form.tsx:20,26,38` | `Student`, `Schedule`, `Note` | `Student` drops `progul`; `Schedule` makes `teacher`/`start_time`/`end_time` required-but-nullable |
| `src/components/kbm-editor.tsx:10` | `Note` | identical to `journal/show`'s |
| `src/components/attendance-grid.tsx:9,15` | `Student`, `AttendanceMap` | `Student` drops `progul`; adds `AttendanceMap = Record<string, Record<number,string>>` |
| `src/app/export/page.tsx:101` | `AbsensiRecord` | **adds `value?: string`** and drops `updated_at` |
| `src/app/export/backup-client.tsx:10` | `AttendanceRecord` | **adds `value?: string`**, drops `unit` and `updated_at` |
| `src/app/admin/absensi/absensi-client.tsx:10` | `AbsensiRecord` | **adds `month: number; year: number`** (not columns — computed), drops `unit` |
| `src/lib/bell-schedule.ts:168` | `ScheduleRecord` | the parse-side shape, `subject`/`subject_display` required, no `id`/timestamps |
| `src/app/api/export/pdf/rekap-presensi/route.tsx:60` | `AttendanceData` | `Record<number, Record<number, Record<number,string>>>` — a pivoted grid, not a row |

So `Absensi` is declared in four shapes across the app (`src/types`, three local
copies) and `Note` in three.

## Data Flow

There is no data flow — the file is inert. For the shapes it *would* describe:

```
supabase/schema.sql (Postgres + RLS)
  → PostgREST / Supabase JS  →  data: any   (no Database generic passed)
  → cast to a local per-file type  →  rendered / exported
```

`waktu` is a `TIMESTAMPTZ` but every consumer treats it as an ISO string
(`absen.waktu.split('T')[0]`, `export/page.tsx:115`). `date` on `notes` is a
`DATE` and `start_time`/`end_time` on `schedules` are `TIME` columns, both
surfaced as plain `string`. Nothing in `src/types` encodes any of that.

**Where the declared types and the live code disagree (concrete, verified):**

1. **`Absensi` omits `value`, the column exists and is used.**
   `schema.sql:50` is `value CHAR(1) CHECK (value IN ('S','I','A'))`.
   - `src/app/api/export/export-waktu/route.ts:86` reads `record?.value || 'A'`
     and then weights it (`S`→1, `I`→0.5, `A`→0) for the time-loss report.
   - `src/app/api/export/backup-save/route.ts:62,81` writes `value` on both the
     `.update({ value })` and the `.insert({ …, value })` path.
   Both had to widen the type locally instead of importing `Absensi`
   (`value?: string` in `export/page.tsx:111` and `backup-client.tsx:19`).

2. **`Absensi.unit: string` is required, but the column has a default.**
   `schema.sql:44` is `unit TEXT DEFAULT 'SMP ABBS Surakarta' NOT NULL`. The
   interface forces every read site to carry the value, and both writers
   hardcode the literal rather than rely on the default
   (`src/app/api/absensi/route.ts:129`, `unit: 'SMP ABBS Surakarta'`). The
   `DEFAULT` clause is therefore dead, and there is no enum/constant for the unit
   name anywhere in the codebase.

3. **`Attendance.value` is the one place the union is right** — `'S'|'I'|'A'`
   matches the `CHECK` exactly — but the export path widens it back to
   `value?: string` in two local types, and `backup-client.tsx` posts whatever
   the `<input type="time">` element held into that column, which violates the
   `CHECK`.

4. **`Profile.mapel` / `MapelAssignment` are narrower than what is stored.**
   `normalizeMapel()` in `src/lib/subject-normalizer.ts:52` returns
   `Record<string, string | string[]>` and `/api/schedule/import` upserts that
   straight into `profiles.mapel`. So the JSONB can hold a bare string per class.
   `src/app/journal/show/page.tsx` accordingly does
   `typeof subjects === 'string' ? [subjects] : subjects` — defensive code that
   the declared type would make unnecessary. `MapelAssignment` itself has **zero
   consumers**; it is structurally identical to `Profile.mapel` minus the
   `| null`.

5. **`Schedule.start_time`/`end_time` are `string` in the type, `TIME` in the
   column.** PostgREST returns `HH:MM:SS`; the bell tables in
   `src/lib/bell-schedule.ts` produce `HH:MM`. Neither is documented in the
   interface, and `Schedule` marks them optional even though the parser always
   sets them (`null` only for the `WITHOUT_TEACHER_SHEETS` path).

6. **`absensis.foto` is documented as a signed-URL bucket but stored as a
   public URL.** `schema.sql:304-308` documents bucket `uploads` as
   `Public: false (use signed URLs)`, while the code writes
   `storage.from('uploads').getPublicUrl(...)` into `absensis.foto`. Nothing in
   `src/types` records that the column holds a URL string rather than a path.

7. **Missing entirely:** no interface for the `attends`/journal pivot
   (`attendances` is there, but the derived `AttendanceMap` /
   `AttendanceSummary` / `NoteIndexed` shapes used by the grid live as local
   aliases in `attendance-grid.tsx:15` and `journal-form.tsx:49-52`), and no
   type for the `uploads` Storage `FileObject` list the explorer page renders.

## Integration Points

**Consumers: none.** Verified by `grep -rn "@/types" src/` (0 hits) and
`grep -rn "from '@/types'"` over the whole repo including `docs/`, `scripts/`
and `supabase/` (0 hits). The only inbound references are the prose in the
already-written `codemap.md` files, including this one.

**Relationship to `supabase/schema.sql`.** The file is a hand-maintained mirror
of the DDL, with no codegen step: `schema.sql` is the source of truth, and the
two drift independently — which is exactly what the seven discrepancies above
show. `schema.sql` also defines two SQL objects with no TS counterpart:
`public.is_admin()` (a `SECURITY DEFINER` helper, `schema.sql:269-277`, used by
the RLS policies) and the `on_auth_user_created` trigger that auto-inserts a
`profiles` row on signup (lines 283-298) — meaning a `Profile` always exists
with `name = raw_user_meta_data->>'name' ?? email` and `is_admin = false` right
after signup, which is why no app code creates the first profile.

**Why the folder still exists / what fixing it means.** Because the Supabase
clients are untyped, the cheapest real fix is not to import these interfaces but
to generate them: pass a `Database` generic into
`createServerClient` in `src/utils/supabase/*.ts`, delete the ten local
declarations, and keep `src/types/index.ts` only for the two derived shapes
(`AttendanceSummary`, `MapelAssignment`) that have no column of their own. Until
that happens, this folder is a place where a field can be renamed in the schema
and in three local copies without any compile error surfacing here.
