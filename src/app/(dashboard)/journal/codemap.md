# src/app/(dashboard)/journal/

## Responsibility

The **class-selection gate** for the KBM journal. It renders nothing but a single `<select>` of classes; submitting it hands control to `/journal/show`. It is the only place in the app that derives the class list dynamically from the `schedules` table rather than from a dedicated lookup.

Single file: `page.tsx` — Async Server Component, 129 lines, exports `metadata` and default `JournalSelectPage`.

## Design

**No client component at all.** The whole interaction is a native HTML GET form, so navigating to the journal editor is a full document request (no client-side routing, no fetch). This is deliberate — the page predates the App Router and its form shape mirrors the legacy Laravel controller.

### Server data pipeline

1. `await cookies()` → `createClient(cookieStore)` from `@/utils/supabase/server`.
2. `auth.getUser()` → `redirect('/login')` if `!user`.
3. **Profile existence probe:** `supabase.from('profiles').select('id').eq('id', user.id).single()` → `if (!profiles) redirect('/login')`. Only `id` is selected, so this is a "does a profile row exist" guard, not a role check — the variable is misnamed `profiles` (plural) for a single row.
4. **Class list:** `supabase.from('schedules').select('class_name').order('class_name')` — this pulls **every** schedule row in the database (RLS policy "Authenticated users can view schedules" allows any signed-in user). It is then reduced to distinct values with `[...new Set(schedules?.map(s => s.class_name) ?? [])]`.
5. **Grouping by grade:** each class string is split on its first character — `grade = c.charAt(0)`, `sub = c.slice(1)` — so `"7A"` becomes `("7", "A")`, `"8B"` becomes `("8", "B")`, and a bare `"7"` becomes `("7", "")`. Results accumulate into `Record<string, string[]>` after a de-dupe check, then each bucket's subs are `.sort()`ed.

### Rendering

- Card: `Card` from `@/components/ui/card` inside `<div className="mx-auto max-w-md">`, rendered under a `PageHeader` (title "Jurnal Kelas", breadcrumb `Beranda` → `/`, same description text).
- Header block: 64×64px icon square (`size-16 shrink-0`, `rounded-sm`, `bg-accent-subtle text-accent`, `aria-hidden`) containing a lucide `BookOpen` icon at `size-8`.
- Form:
  ```tsx
  <form action="/journal/show" method="GET" className="w-full">
    <input type="hidden" name="usr" value={user.id} />
    <Select id="classSelect" name="class" required>
      <option value="" disabled>-- Pilih Kelas --</option>
      ...optgroups...
    </Select>
    <Button type="submit" variant="primary" className="w-full">Lanjutkan</Button>
  </form>
  ```

### The class-name normalisation rules (important domain logic)

| Rule | Effect |
|---|---|
| `.filter(([grade]) => !['0','k','a'].includes(grade))` | Silently drops grade buckets `'0'`, `'k'`, `'a'` (lowercase/zero artifacts from the aSc timetable export) |
| `grade in ['7','8','9'] && subs.length === 0` | Injects an extra `<option value={grade}>Leadership Class {grade}</option>` when a grade has no letter-suffixed classes |
| `/^\d+$/.test(full)` → `Leadership Class ${full}` | A purely numeric class name (e.g. `"7"`, i.e. `sub === ''`) is relabelled "Leadership Class 7" |
| otherwise | `<option value={full}>{full}</option>` — raw class name like `7A` |

The disabled placeholder `<option value="">` is the first child, so it is the browser default; the real "nothing selected" guarantee comes from `required`. The `Select` primitive is controlled via `defaultValue=""`.

## Data Flow

```
Browser  ──GET /journal─────────────────────────────────────────►
        ◄── HTML (server component) with <form action="/journal/show" method="GET">
Browser  ──GET /journal/show?class=7A&usr=<uuid>────────────────►  (full page nav)
```

- No fetch, no API route, no client state. `usr` is carried purely as a hidden query param so `/journal/show` knows who is asking.
- Downstream, `/journal/show` re-reads `class` (uppercased) and independently re-verifies the session with `auth.getUser()`; it does **not** trust `usr` for authorization (it defaults `usr` to `user.id` but never uses the value for queries — `teacher_id` is written as `null` from the client and falls back to `user.id` inside `/api/journal/save-note`).

## Integration Points

- **Auth:** in `middleware.ts`'s `protectedRoutes`, so `/journal` is edge-protected; the page repeats the guard server-side.
- **Table read:** `schedules.class_name` only. This is the same query shape used by `(dashboard)/prevSmes/page.tsx` (the class-picker logic there is a near-duplicate of this file, including the `['0','k','a']` filter and the `Leadership Class` labelling).
- **Outbound link:** the teacher nav entry `/journal` — "Jurnal", lucide `NotebookPen` — lives in `src/components/teacher-nav.tsx:47`. The old `src/components/navbar.tsx` / `mobile-nav.tsx` components were deleted in the DS v2 migration.
- **Downstream:** `/journal/show` consumes `class` + `usr` and additionally accepts `month`, `year`, `day` (which this page does not send).
- **RLS:** the `schedules` SELECT policy is `auth.role() = 'authenticated'`, which is why any teacher can enumerate all class names here even though only admins may write schedules.
- **Layout:** the route lives under the `(dashboard)` group (`page.tsx` in `src/app/(dashboard)/journal/`), so it renders inside `(dashboard)/layout.tsx` → `TeacherShell` → `AppShell` → `TeacherNav` plus `Scripts`. The old claim that it was a sibling rendering the root layout only no longer holds.
- **Design system:** DS v2 composition — `PageHeader` + `Card`/`CardContent` + `Select`/`Label` + `Button`. The pre-DS-v2 composition described by `docs/brutalist-design-spec.md` §4.3 is historical.