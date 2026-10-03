# Design: Database Security Hardening & API Auth Consolidation

- **Date:** 2026-09-30
- **Status:** Draft for review
- **Scope lock:** `supabase/schema.sql`, `middleware.ts`, `src/app/api/**`
- **Explicitly out of scope:** `src/app/admin/**`, `src/components/**`, `src/app/(dashboard)/**` — actively being refactored in parallel

## 1. Context

NgajarYuk Next is a school attendance and teaching-journal system for SMP ABBS Surakarta, backed by Supabase. An audit of the database layer found four exploitable weaknesses. A parallel refactor is currently rewriting the design system and admin pages, so this work is confined to files that are not moving (`src/app/api/**`, `middleware.ts`, `supabase/schema.sql` — all last written 19:39, while the refactor is writing 20:19+).

The database holds live teacher and student data. Every change must therefore be additive or guarded, idempotent, and individually revertible. There is no test suite.

### 1.1 Confirmed findings

| ID | Finding | Evidence |
|----|---------|----------|
| **V1** | **Privilege escalation.** `"Users can update own profile"` is `FOR UPDATE USING (auth.uid() = id)` with no `WITH CHECK`. PostgreSQL falls back to `USING` for the check, which constrains only `id` — not `is_admin`. Any authenticated teacher can set their own `is_admin = true` using only the browser-visible publishable key. | `supabase/schema.sql:129-130` |
| **V2** | **`SECURITY DEFINER` without `SET search_path`.** `is_admin()` and `handle_new_user()` are both `SECURITY DEFINER` plpgsql with no `search_path` pin. A user able to create objects in a schema earlier on the path can shadow `profiles` or `auth.uid()` and force `is_admin()` to return true. | `schema.sql:277`, `schema.sql:294` |
| **V3** | **Zero policies on `storage.objects`.** The `uploads` bucket's access rules exist only as undocumented dashboard state. | `grep -c storage.objects` → 0 |
| **V4** | **13 policies inline the admin check** as `EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)`. Four of these sit on `public.profiles` itself — a subquery on the same table the policy governs, which is Supabase's documented infinite-recursion hazard. `SECURITY DEFINER` on a shared helper is the correct fix. | 13 policies across 6 tables |

`public.is_admin()` is **never called from TypeScript** — all 29 route handlers read the column and compare in application code. Redefining it is therefore safe.

### 1.2 Residual risk accepted in this design

`uploads` is a public bucket so attendance photos render via `getPublicUrl` (`src/app/api/absensi/route.ts:123`). Making the bucket private requires an app change (signed URLs) and is **out of scope**. This means teacher attendance photos — which carry GPS coordinates and timestamps — remain readable by anyone holding the URL. Recorded in §7 as accepted risk with a recommended follow-up.

## 2. Goals and non-goals

**Goals**
1. Eliminate V1–V4 at the database layer.
2. Consolidate the copy-pasted auth preambles in Route Handlers behind one helper.
3. Fix the three API-layer privilege defects: missing gate on `/api/import-students`, 15 privileged calls on the publishable key, and `schedule/[id]`.
4. Ship every change with a matching rollback and a verification script.

**Non-goals**
1. Deleting the 13 dead route files / 32 dead verbs — **deferred**. The caller graph is in flux; deletion would be unverifiable and could break the in-flight admin refactor.
2. Any change to admin pages or components.
3. Making the `uploads` bucket private.
4. Adding missing unique constraints on `notes` / `schedules` (correctness, not security) and adding `absensis.year` / `absensis.month` — both are availability bugs, filed separately.

## 3. Approach

Four independently-revertible migrations (Block A) followed by a mechanical helper consolidation (Block B).

**Rejected — minimal patch (touch only V1–V3).** Leaves V4's duplication and recursion hazard in place for the next contributor to copy.

**Rejected — trigger-only enforcement.** Triggers also fire under `service_role`, which is genuinely stronger, and the design *does* use a trigger for V1 (see §4.2) where it is strictly correct. But using triggers as the primary control for the other 13 policies would hide enforcement outside the policy section of `schema.sql`. Policy consolidation is chosen there.

**Rejected — column-level `GRANT`/`REVOKE`.** RLS is the correct primary control in Supabase. Adding `REVOKE`s would be defence in depth at the cost of an extra failure mode; not justified while V1–V4 are unfixed.

## 4. Block A — Database security

Each step is one migration file plus a `down` rollback. Apply in order; each is independently revertible.

### 4.1 A1 — Pin `search_path` on `SECURITY DEFINER` functions

Closes **V2**. Pure hardening, no behavioural change.

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

`pg_temp` is appended last so temp objects cannot shadow anything. `handle_new_user()` receives the same treatment; all its table references are already schema-qualified.

Function volatility is deliberately left at the default so A1 remains a no-op semantically.

**Rollback:** restore the two function bodies without the `SET search_path` clause.

### 4.2 A2 — Block self-promotion

Closes **V1**.

**Mechanism: `BEFORE UPDATE` trigger on `profiles`, not an RLS `WITH CHECK` clause.**

Reasoning: a policy `WITH CHECK` can only see the *new* row, so detecting a change requires a subquery comparing against the statement snapshot — which reintroduces the same-table recursion hazard as V4. A trigger sees `OLD` and `NEW` directly, evaluates nothing recursively, and **still fires under `service_role`**, which bypasses RLS entirely. That last property matters because `createServiceClient()` exists in this codebase. This refines the mechanism discussed at design time; the outcome is identical and strictly stronger.

```sql
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.is_admin, NEW.mapel) IS DISTINCT FROM (OLD.is_admin, OLD.mapel)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'is_admin and mapel may only be changed by an administrator'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();
```

**Why this breaks nothing — verified against live code:**

| Path | `is_admin`/`mapel` change? | Caller is admin? | Result |
|---|---|---|---|
| `PUT /api/profile` | No — sends only `name`, `phone_num` (`api/profile/route.ts:39-41`) | n/a | Passes without evaluating `is_admin()` |
| `PUT /api/admin/teachers/[id]/make-admin` | Yes | Yes | Passes |
| `PUT /api/admin/teachers/[id]/mapel` | Yes | Yes | Passes |
| Teacher self-promotion attempt | Yes | No | **`42501` raised** |

`handle_new_user()` performs an `INSERT`, so the `BEFORE UPDATE` trigger does not fire on signup.

**Rollback:** `DROP TRIGGER guard_profile_privileges ON public.profiles;` and drop the function.

### 4.3 A3 — Explicit `storage.objects` policies

Closes **V3**, converting undocumented dashboard state into reviewed SQL.

- `SELECT` for `anon` and `authenticated` on `bucket_id = 'uploads'` — preserves today's working behaviour (photos render).
- `INSERT` for `authenticated` on `bucket_id = 'uploads'` — a teacher uploading their own check-in photo (`api/absensi/route.ts:110`).
- `UPDATE` and `DELETE` for `authenticated`, gated on `bucket_id = 'uploads' AND public.is_admin()` — restricts rename and removal, including the four admin absensi deletion paths that call `storage.from('uploads').remove(...)`.

`public.is_admin()` is `SECURITY DEFINER`, so calling it from a `storage.objects` policy reads `profiles` without recursion.

Each statement is preceded by `DROP POLICY IF EXISTS` so the migration is re-runnable and tolerates pre-existing dashboard-created policies.

**Rollback:** drop the four policies.

### 4.4 A4 — Consolidate the admin check onto `is_admin()`

Closes **V4**. Rewrites the 13 policies listed below, replacing

```sql
EXISTS (SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE)
```

with `public.is_admin()`.

Affected policies: `Admins can {view all, insert, update all, delete} profiles`, `Admins can {insert, update, delete} students`, `Admins can {insert, update, delete} schedules`, `Admins can {insert, update} attendances`, `Admins can delete absensis`.

**Behavioural risk, stated plainly:** the inlined form is subject to `profiles` RLS; the helper is not. For the four policies on `profiles` itself, the inlined form can hit recursion, so A4 may make admin operations that *silently fail today* start succeeding. That is the correct direction, but it must be confirmed rather than assumed — `verify.sql` therefore records an admin-operation baseline **before** A4 and compares after (§5).

**Rollback:** the `down` script restores the previous 13 policy bodies verbatim.

## 5. Verification

`verify.sql` is a read-only assertion script run against the live database. It must be run **twice**: once before A4 to capture the admin baseline, once after the full Block A to confirm no regression.

| # | Assertion | Expected |
|---|---|---|
| 1 | Teacher `UPDATE profiles SET is_admin = true` on own row | `42501` raised |
| 2 | Teacher `UPDATE profiles SET name = ...` on own row | Succeeds |
| 3 | Teacher `UPDATE profiles SET mapel = ...` on own row | `42501` raised |
| 4 | Admin `UPDATE profiles SET is_admin = true` on another row | Succeeds |
| 5 | Non-admin `DELETE FROM absensis` | 0 rows affected (RLS) |
| 6 | Admin `DELETE FROM absensis` | Matches baseline from pre-A4 run |
| 7 | `SELECT public.is_admin()` as admin / as teacher | `true` / `false` |
| 8 | All 13 consolidated policies exist and reference `public.is_admin()` | 13 / 13 |
| 9 | The 10 non-admin policies are byte-unchanged | Pass |
| 10 | Row counts on all 6 tables | Unchanged from pre-migration snapshot |

Assertions 1–4 run as `DO` blocks with exception trapping so the script reports rather than aborts on the first failure.

`ROW COUNT` snapshots are recorded in a `security_baseline` temp table so the same script can compare two runs.

## 6. Block B — API auth consolidation

### 6.1 New module `src/lib/api-auth.ts`

```ts
export type AuthResult =
  | { user: { id: string; email?: string };
      profile: { id: string; name: string; is_admin: boolean; mapel: unknown };
      supabase: SupabaseClient }
  | { error: NextResponse }

export async function requireUser(): Promise<AuthResult>
export async function requireAdmin(): Promise<AuthResult>
```

`requireAdmin()` collapses the current two round trips (`auth.getUser()` followed by a separate `select('is_admin')`) into one. Usage:

```ts
const auth = await requireAdmin()
if (auth.error) return auth.error
const { supabase, profile } = auth
```

### 6.2 Migration order

**38 preambles across 29 route files.** Five multi-verb routes repeat the check once per verb, which is where the extra 9 come from:

| File | Preambles |
|---|---|
| `api/admin/student/route.ts` | 3 |
| `api/admin/absensi/route.ts` | 3 |
| `api/admin/teachers/[id]/route.ts` | 3 |
| `api/schedule/[id]/route.ts` | 3 |
| `api/admin/teachers/route.ts` | 2 |

Each handler is migrated in its own commit so any single regression is trivially revertible. The 9 files that intentionally lack an admin gate (see §8) are handled individually rather than swept.

### 6.3 Three privilege defects fixed alongside

| Defect | Fix |
|---|---|
| `POST /api/import-students` checks only `user`, never `is_admin` — any teacher can mass-upsert `students` | `requireAdmin()` |
| 15 `auth.admin.*` calls on the publishable key (`api/admin/import-teachers`, `api/admin/teachers`, `api/admin/teachers/[id]`, `api/schedule/import`) | `createServiceClient()` |
| `api/schedule/[id]` builds a service-role client with an empty cookie adapter, then calls `auth.getUser()` — always 401, and RLS-bypassing if it ever succeeded | `requireAdmin()` with the normal cookie-scoped client |

### 6.4 No deletions

Block B is purely additive. Removing dead endpoints is deferred until the admin refactor lands and the caller graph is stable.

## 7. Accepted risks

| Risk | Rationale | Follow-up |
|---|---|---|
| `uploads` stays public, so attendance photos (with GPS + timestamp) are readable by URL | Photos render via `getPublicUrl`; privatising needs signed URLs and an app change | Migrate to signed URLs in a separate change |
| `notes` and `schedules` `onConflict` upserts target columns with no unique constraint — expected to fail with `42P10` | Availability, not security; verifying may prove it is worse than believed | Check first — if these upserts fail, the KBM journal is fully broken and this becomes Critical |
| `absensis` is filtered on `month` / `year` columns that do not exist | Pre-existing defect, unrelated to security | File separately |
| `middleware.ts` re-implements the Supabase client instead of importing `utils/supabase/middleware.ts` | Cosmetic duplication; both are 19:39 files so it is in scope, but it is not a security defect | Fold into a later pass |

## 8. Files with no admin gate — intentional or bug?

| File | Verdict |
|---|---|
| `api/auth/login`, `api/auth/logout`, `api/profile`, `api/profile/password`, `api/absensi`, `api/journal/save-all`, `api/journal/save-note` | **Intentional** — self-scoped actions |
| `api/import-students` | **Bug** — fixed in §6.3 |
| `api/schedule/preview` | **Needs review** — parses an uploaded file, read-only, but admin-gated in `middleware.ts` anyway |

## 9. Delivery

Block A and Block B are delivered as **two separate implementation plans**. Block A is four SQL migrations plus verification — self-contained, no application code. Block B is a TypeScript helper plus 38 call-site migrations across 29 files. Combining them would make a plan too large to execute reliably against a live database with no test suite.

**Plan 1 — Block A (database only)**

```
supabase/migrations/
  20260930_01_pin_search_path.sql           + .down.sql
  20260930_02_guard_profile_privileges.sql  + .down.sql
  20260930_03_storage_policies.sql          + .down.sql
  20260930_04_consolidate_admin_check.sql   + .down.sql
supabase/verify.sql          # §5 assertions — run before A4, then after the block
supabase/schema.sql          # refreshed to the post-migration state
```

Rollout: run `verify.sql` to capture the baseline → apply A1 → A2 → A3 → A4 → run `verify.sql` again → compare. If any assertion regresses, run that step's `.down.sql` only.

**Plan 2 — Block B (application only)**

```
src/lib/api-auth.ts   # §6.1
```

plus one commit per migrated handler, and the three defect fixes in §6.3. Starts only after Plan 1 is verified on the live database, so a rollback there never coincides with application changes.

**Committing this document is deliberately deferred.** The working tree holds 61 modified and 40 untracked files belonging to the in-flight admin/design-system refactor. Committing now would sweep that unfinished work into history. The spec is written to disk only; it should be committed once the refactor lands, or committed alone with `git add docs/superpowers/specs/…`.
