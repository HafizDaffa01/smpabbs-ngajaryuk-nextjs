# src/components/

The shared React layer. The top level holds the two app shells plus a handful of
journal-facing islands; `ui/` (design-system primitives) and `admin/` (admin
chrome) are documented separately, as is `pdf/`.

| File | Lines | Role | Consumers |
|---|---|---|---|
| `teacher-shell.tsx` | 55 | Server wrapper: resolves the signed-in teacher, renders `AppShell`. Never redirects | `(dashboard)/layout.tsx:1` |
| `app-shell.tsx` | 551 | Client teacher chrome: collapsible rail, off-canvas mobile drawer, topbar | `teacher-shell.tsx:3` |
| `teacher-nav.tsx` | 200 | Shared nav data + `TeacherNav` renderer, `isNavActive`, `SEGMENT_LABELS` | `app-shell.tsx:28` |
| `scripts.tsx` | 23 | Renders `null`; calls `useSwalTheme()` | `(dashboard)/layout.tsx:2` |
| `toast-provider.tsx` | 149 | Context + `useToast()` hook | `src/app/layout.tsx:5` |
| `period-badge.tsx` | 23 | Current academic period chip (`Badge` primitive) | **none** |
| `attendance-grid.tsx` | 406 | Student × day S/I/A grid | `(dashboard)/journal/show/journal-form.tsx:16` |
| `kbm-editor.tsx` | 259 | Per-subject journal modal | `(dashboard)/journal/show/journal-form.tsx:17` |
| `logout-button.tsx` | 70 | `POST /api/auth/logout` button | **none** |

There is no `index.ts` barrel — every import is by file path. `navbar.tsx` and
`mobile-nav.tsx` were **deleted**; their role belongs to `app-shell.tsx` now.

## Responsibility

- **App chrome (teacher):** `teacher-shell.tsx` is the server half — it calls
  `cookies()` → `createClient()` → `auth.getUser()` → `profiles{name, is_admin}`
  and hands a plain `ShellUser` to the client `app-shell.tsx`. If there is no
  user it returns `children` bare (line 36), so chrome-free routes can be
  wrapped too. `app-shell.tsx` renders the sidebar rail (persisted collapsed in
  `localStorage` under `teacher-sidebar-collapsed`, read through
  `React.useSyncExternalStore` with an `ngajaryuk:teacher-sidebar-collapsed`
  event), the mobile drawer, the topbar, the `ThemeToggle`, and the account
  dropdown with logout.
- **Navigation data is one shared registry**, not two duplicated arrays:
  `teacher-nav.tsx` exports `TEACHER_NAV_GROUPS`, `ADMIN_NAV_ITEM`,
  `SEGMENT_LABELS`, `isNavActive(pathname, href)` and the `TeacherNav`
  component. Admins get `TEACHER_NAV_GROUPS` plus a trailing `ADMIN_NAV_ITEM`
  group (`teacher-nav.tsx:114`).
- **Admin chrome** lives in `components/admin/` (`shell.tsx`, `sidebar.tsx`,
  `topbar.tsx`), mounted by `src/app/admin/layout.tsx:43` behind a layout-level
  `is_admin` gate that redirects to `/login` / `/unauthorized`. The two shells
  share tokens, radius, elevation and icon language but keep **separate**
  collapse state (different localStorage keys and event names).
- **Feedback:** one global toast queue (`toast-provider.tsx`), plus
  `scripts.tsx`, which renders nothing and only calls `useSwalTheme()` so the
  SweetAlert2 palette tracks the `.dark` class on `<html>`.
- **Two data-entry surfaces for the journal page:** a spreadsheet-like
  attendance grid, and a per-subject KBM (journal) editor.

## Design

**The client/server split is deliberate here.** `teacher-shell.tsx` is a
Server Component (it uses `cookies()`); `app-shell.tsx`, `teacher-nav.tsx`,
`attendance-grid.tsx`, `kbm-editor.tsx`, `toast-provider.tsx` and `scripts.tsx`
are `'use client'`. Only the shell touches Supabase — and only from the server
side now, so a full page load no longer fires duplicate client-side auth reads
the way the two deleted nav bars did. `(dashboard)/export/backup-client.tsx`
re-implements a local 3-line toast queue instead of calling `useToast()`, even
though it sits inside the root `ToastProvider`.

**Context Provider pattern (`toast-provider.tsx`) — the folder's only React
context.** `createContext<ToastContextValue | null>(null)` (line 28) is typed
nullable; `useToast()` (line 144) throws
`'useToast must be used within ToastProvider'` when it is null, turning a
misplaced provider into a named error instead of `undefined` crashes. Timers are
tracked in a `timersRef` Map and cleared on unmount (lines 66–67) — the naive
`setTimeout` used to fire `setToasts` after the root layout unmounted.
`<ToastProvider>` is mounted in `src/app/layout.tsx:5`, so toasts work on every
route, including `/login` and the terminal-state pages.

**Icons are `lucide-react` components.** There is no icon font, no
`data-feather` markup, and no icon CDN. `scripts.tsx`'s doc comment records
that the former `feather.replace()` call was removed once the last
`data-feather` node disappeared.

**`attendance-grid.tsx` — a controlled grid with local "open cell" state.**
Props: `students`, `attendanceMap`, `summaryMap`, `day`, `month`, `year`,
`grade`, `onAttendanceChange(studentId, day, 'S'|'I'|'A'|'')`. It owns exactly
two pieces of state: `searchQuery` and `openCell` (lines 79–80). Clicking a cell
opens a 4-button popover (`S`/`I`/`A`/`—`); choosing one calls
`onAttendanceChange` and closes it. A `mousedown` outside-click effect (120–128)
and a `keydown` effect (131–156) close it — the latter also supports Escape and
ArrowUp/ArrowDown traversal of the four options via `[data-att-option]`.
`daysInMonth = new Date(year, month, 0).getDate()` (line 96) drives the column
count. Column widths are named constants — `NO_COL = 80`, `NAME_COL = 140`,
`DAY_COL = 44`, `SUM_COL = 40` (lines 53–56) — combined into
`tableMinWidth = dayColumns.length * DAY_COL + NO_COL + NAME_COL + SUM_COL * 3`
(line 116) and applied to the `Table` primitive via inline `style`.

**`kbm-editor.tsx` — list + modal, save delegated upward.** Props: `subjects`,
`noteIndexed`, `classValue`, `selectedDate`, `onSave(subject, note)`. It renders
one `Card` per subject (click to open, showing a saved-state `Badge` and a
100-char preview) and a `Dialog` with a date field, subject, and textarea.
State: `isOpen`, `currentSubject`, `noteText`, `saving` (lines 54–57).
SweetAlert2 (`sweetalert2` npm, imported at line 7) handles validation and
result feedback; `handleSave` refuses an empty subject/note and only closes the
dialog on success.

**Styling is DS v2.** `globals.css` is the token source: ~196 `--ds-*`
declarations, an `@theme inline` bridge, and a `.dark` block keyed off
`@custom-variant dark (&:where(.dark, .dark *));`. Light is the default; a
blocking inline script in `src/app/layout.tsx:63` reads `localStorage.theme`
before first paint so there is no flash of the wrong scheme, and
`ui/theme-toggle.tsx` toggles the `.dark` class on `<html>`.
`docs/brutalist-design-spec.md` is **historical** — it describes the pre-DS-v2
brutalist / Bootstrap-parity system, not the current contract. Tailwind 4 here
is CSS-first: there is no `tailwind.config.*`.

**Class names go through `cn()`**, which is `twMerge(clsx(inputs))` in
`src/lib/utils.ts` — not a bare `filter(Boolean).join(' ')`. That matters here:
both `attendance-grid.tsx:18` and `kbm-editor.tsx` pass caller overrides into
`cn()` on primitives whose own defaults set the same utility groups, and
`twMerge` is what makes the override win. Primitives also require `className` to
stay the **last** `cn()` argument (see [ui/codemap.md](ui/codemap.md)).

**Third-party CSS.** `kbm-editor.tsx:4-6` imports `flatpickr` plus its
`themes/airbnb.css` and `l10n/id.js`; the flatpickr *dark theme* stylesheet is
still linked from the root `src/app/layout.tsx:69-73`. `attendance-grid.tsx`
no longer imports flatpickr at all.

## Data Flow

```
GET any (dashboard) route
  └─ (dashboard)/layout.tsx
       ├─ <TeacherShell/>        cookies() → createClient() → auth.getUser()
       │                         → profiles{name, is_admin} → AppShell
       │                         (no user ⇒ children bare, no redirect)
       │    └─ <AppShell/>       useSyncExternalStore(collapse) → <TeacherNav/>
       │                         → <ThemeToggle/> (src/components/app-shell.tsx:482)
       │                         → logout: fetch POST /api/auth/logout
       ├─ <Scripts/>             useSwalTheme() (SweetAlert2 palette, null render)
       └─ children

/admin/*  →  admin/layout.tsx: auth.getUser() → profiles.is_admin
             → <AdminShell/> (components/admin/) → children

<ToastProvider> (root layout, all routes)
  useToast() → addToast(type, text) → setToasts([…]) → auto-remove after 3000 ms

(dashboard)/journal/show  (server page → JournalForm → AttendanceGrid + KbmEditor)
  server: students / schedules / notes / attendances  →  local maps as props
  AttendanceGrid ── onAttendanceChange(studentId, day, 'S'|'I'|'A'|'') ──▶ JournalForm state
  KbmEditor      ── onSave(subject, note) ──▶ JournalForm → POST /api/journal/save-note
```

**Logout flow.** `app-shell.tsx` exposes a shared `useLogout()` hook (lines
80–100): `POST /api/auth/logout`, and only on `response.ok` does it
`router.push('/login')` + `router.refresh()`, guarded by a `loggingOut` state
and a `catch` that logs `'Logout failed'`. `logout-button.tsx` implements the
same endpoint with the same guard but has **no importers** — dead code.

**`period-badge.tsx`** calls `getCurrentPeriod()` during render, i.e. `new Date()`
per render, in a `'use client'` component with no state. It currently has **zero
consumers**, so the period rollover behaviour is moot until something renders it.

## Integration Points

**Upstream (imports).**

| Symbol | Imported from | Used by |
|---|---|---|
| `cookies` | `next/headers` | `teacher-shell.tsx:1` |
| `createClient` | `@/utils/supabase/server` (cookie-scoped) | `teacher-shell.tsx:2` |
| `cn` | `@/lib/utils` (`twMerge(clsx(...))`) | `attendance-grid.tsx:18`, `kbm-editor.tsx`, `app-shell.tsx:17` |
| `lucide-react` | npm | all except `teacher-shell.tsx`, `toast-provider.tsx` |
| `ui/*` primitives | `@/components/ui/*` | `app-shell.tsx`, `teacher-nav.tsx`, `attendance-grid.tsx`, `kbm-editor.tsx`, `period-badge.tsx` |
| `sweetalert2` | npm | `kbm-editor.tsx:7` |
| `flatpickr` + airbnb theme + `l10n/id` | npm | `kbm-editor.tsx:4-6` |

**Downstream (consumers).**

- `teacher-shell` → **only** `src/app/(dashboard)/layout.tsx:1`.
- `app-shell` → **only** `teacher-shell.tsx:3`.
- `teacher-nav` → **only** `app-shell.tsx:28`.
- `scripts` → **only** `src/app/(dashboard)/layout.tsx:2`.
- `toast-provider` → `src/app/layout.tsx:5` (`<ToastProvider>`) and
  `(dashboard)/profile/profile-form.tsx:16` (`useToast()`).
- `attendance-grid`, `kbm-editor` → **only**
  `(dashboard)/journal/show/journal-form.tsx`. Nothing under `/admin` or
  `/export` uses them.
- `period-badge`, `logout-button` → **zero consumers** (dead code).

**API routes reached.** `POST /api/auth/logout` (app shell + logout-button).

**Known discrepancies / bugs.**

- **`period-badge.tsx` and `logout-button.tsx` are unreachable dead code.** The
  shell renders its own period/account affordances; `logout-button.tsx` has no
  importers at all.
- **`kbm-editor.tsx` destructures `classValue` and does not use it**, and it
  computes `displayDate` without rendering it — the date actually saved comes
  from the parent's `selectedDate`.
- **`attendance-grid.tsx` destructures `grade`** and does not use it.
- **`backup-client.tsx` re-implements the toast queue** locally instead of
  using `useToast()`, despite being inside the root `ToastProvider`.
- **`attendance-grid` / `kbm-editor` each declare their own `Student` / `Note` /
  `AttendanceMap` / `SummaryMap` local types** instead of importing
  `@/types` (see [types/codemap.md](../types/codemap.md)).
