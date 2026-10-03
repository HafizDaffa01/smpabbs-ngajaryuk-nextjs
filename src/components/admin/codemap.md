# src/components/admin/

The **admin shell** — the app's dedicated navigation chrome for `/admin/*`.
Created because `src/app/(dashboard)/layout.tsx` wraps exactly one route (`/`),
so before this existed every other route in the app rendered with no navigation
at all. Mounted by `src/app/admin/layout.tsx` (see `src/app/admin/codemap.md`).

All three files are client components. Server data (the signed-in admin's
`name` / `email`) arrives as a plain serializable prop from the server layout.

| File | Exports | Responsibility |
|---|---|---|
| `shell.tsx` | `AdminShell` | Owns the two pieces of shared state — the collapsed desktop rail and the mobile off-canvas drawer. Renders the fixed `<aside>`, the drawer + scrim, the main column, and the sticky `<Topbar>`. |
| `sidebar.tsx` | `Sidebar`, `type AdminUser` | Brand block, grouped nav, footer user block + logout button, and the rail-collapse control. |
| `topbar.tsx` | `Topbar` | Mobile hamburger, breadcrumb, `ThemeToggle`, and the account `Dropdown`. |

`AdminUser` is declared in `sidebar.tsx` but is the *shell's* shared type —
`topbar.tsx` imports it with `import type { AdminUser } from './sidebar'`, and
`shell.tsx` re-exports nothing. That type placement is slightly awkward: the
layout consumes a type owned by a leaf component.

## Data Flow

```
src/app/admin/layout.tsx  (async Server Component)
  │ await cookies() → createClient(cookieStore) → supabase.auth.getUser()
  │ profiles.select('name, is_admin').eq('id', user.id).single()
  │ redirect('/login') if !user ; redirect('/unauthorized') if !profile.is_admin
  ▼
<AdminShell user={{ name, email }}>      ← 'use client', children passed as a slot
  │
  ├── usePathname()                     ← route is the only shared input
  ├── useSyncExternalStore → collapsed rail width
  │     localStorage['admin-sidebar-collapsed'] === '1'
  │     event  'ngajaryuk:sidebar-collapsed'
  │     server snapshot: false
  ├── useState<{at: string} | null>     ← mobile drawer; openness DERIVED
  │     drawerOpen = drawer !== null && drawer.at === pathname
  │
  ├── <aside>  <Sidebar variant="desktop" collapsed onToggleCollapse />
  ├── drawer   <Sidebar variant="mobile"  onClose />
  └── <div>    <Topbar user onOpenDrawer drawerOpen menuButtonRef />
                    └── children   (server-rendered admin pages, passed through)
```

The only outbound network calls in the folder: `POST /api/auth/logout` from
`sidebar.tsx` and `topbar.tsx` (**duplicated verbatim**, see below).

## Design

### `shell.tsx` — `AdminShell`

Props: `{ user: AdminUser; children: React.ReactNode }`.

**Collapsed-rail store.** Module-level external store, hand-rolled exactly like
`theme-toggle.tsx`: `subscribeCollapsed` listens on
`'ngajaryuk:sidebar-collapsed'`, `getCollapsedSnapshot` reads
`localStorage['admin-sidebar-collapsed'] === '1'` in a `try/catch`,
`getCollapsedServerSnapshot` returns `false`, and `setCollapsed` writes and
dispatches. Read via `React.useSyncExternalStore` so the first client render
matches the server HTML (no hydration mismatch) and then restores the saved
width. `toggleCollapsed` deliberately calls
`setCollapsed(!getCollapsedSnapshot())` — reading the store directly rather than
closing over the `collapsed` value, so the callback has an empty dep array.

**Width contract.** The rail width is published once, on the root node:

```tsx
<div className="flex min-h-dvh"
     data-ds-shell
     style={{ '--sidebar-w': collapsed ? '72px' : '264px' } as React.CSSProperties}>
```

Both consumers read it: `<aside className="… w-[var(--sidebar-w)] lg:block">`
and the main column's `lg:pl-[var(--sidebar-w)]`, so the rail and the content
offset cannot drift apart. Expanded 264px / collapsed 72px.

**Derived drawer state (the notable design decision).** Openness is *derived*
from the route — `drawerOpen = drawer !== null && drawer.at === pathname` — not
synchronised by an effect. `openDrawer` stores the current `pathname` in state,
so a client navigation automatically closes the drawer with no extra render pass
and no state-sync effect. `closeDrawer` sets `null`.

**Drawer a11y**, all hand-rolled (no Radix):
- The wrapper is `fixed inset-0 z-50 lg:hidden` with
  `aria-hidden={!drawerOpen}` and React 19's boolean `inert={!drawerOpen}`.
- The scrim (`onClick={closeDrawer}`) fades `opacity-0 ↔ opacity-100`; the panel
  slides `-translate-x-full ↔ translate-x-0`. Both transitions are
  `duration-[250ms] ease-[var(--ds-ease)]`, matching
  `--ds-duration-slow: 250ms`.
- The panel is `role="dialog" aria-modal="true" aria-label="Menu navigasi"`.
- One `keydown` effect (deps `[drawerOpen, closeDrawer]`) handles `Escape` and a
  manual focus trap: it queries all matches of a module-level `FOCUSABLE`
  selector string, and on `Tab` from the last element wraps to the first
  (shift-tab from first wraps to last). The same effect saves, sets and restores
  `document.body.style.overflow` to lock page scroll.
- A second effect moves focus to the first focusable inside the panel on open and
  returns focus to `menuButtonRef` on close, gated by a `wasDrawerOpen` ref so it
  only fires on an actual close.

**Known wiring gap:** `Sidebar` declares a `panelRef?: React.Ref<HTMLDivElement>`
prop and attaches it to its root `<div>` (sidebar.tsx:72, 105), but `shell.tsx`
never passes it — the shell uses its own `drawerPanelRef` on the wrapper `<div>`
one level up. The prop is currently dead.

**Main column.** `<div className="flex min-w-0 flex-1 flex-col lg:pl-[var(--sidebar-w)]">`
→ `<Topbar … />` → `<main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">`
→ `<div className="mx-auto w-full max-w-[1440px]">{children}</div>`. The `min-w-0`
is what allows flex children to shrink instead of forcing horizontal overflow.

### `sidebar.tsx` — `Sidebar`

Props: `{ user, variant: 'desktop' | 'mobile', collapsed?, onToggleCollapse?,
onClose?, panelRef? }`. `isCollapsed = variant === 'desktop' && collapsed` — so
the mobile drawer is *always* expanded, and `onToggleCollapse` is only wired for
the desktop rail.

**Nav model.** A module-level `const NAV_GROUPS: NavGroup[]` drives everything;
`NavItem = { href, label, icon: LucideIcon }`. Three groups:

| Group | Route | Label | Icon |
|---|---|---|---|
| Ringkasan | `/admin` | Ringkasan | `LayoutDashboard` |
| Data Master | `/admin/teachers` | Guru | `Users` |
| | `/admin/import-teachers` | Import Guru | `UserPlus` |
| | `/admin/import` | Import Siswa | `FileSpreadsheet` |
| | `/admin/tsmanager` | TS Manager | `BookOpenCheck` |
| Absensi | `/admin/absensi` | Absensi | `CalendarCheck` |

`isActive(pathname, href)`: `/admin` is active on an **exact** match only; every
other entry matches exactly or by `startsWith(href + '/')`. All 6 hrefs
correspond to existing routes.

**Active styling** is three parts: `bg-accent-subtle text-accent-subtle-text`, a
`title` attribute when collapsed, `aria-current="page"`, and a 3px
`bg-accent` left bar (`absolute top-1/2 -left-2 h-6 w-[3px] -translate-y-1/2
rounded-r-full`) rendered only on the active item. Item height is
`h-11 lg:h-10` (44px mobile / 40px desktop) with `gap-0.5` between items.
Collapsed items keep the `title` so the label is still reachable on hover, and
the group `<p className="eyebrow">` is replaced by a 24px hairline divider.

**Brand block.** `h-15` (60px) header: a `bg-accent text-on-accent` 36px
rounded-md tile with `BookOpen`, then "NgajarYuk" / "SMP ABBS Surakarta"
(truncated, hidden when collapsed). The whole block is a `Link href="/admin"`
with `aria-label="NgajarYuk — beranda admin"`, and it calls `onClose` so the
drawer dismisses. In `variant === 'mobile'` a 40px `X` button
(`aria-label="Tutup menu navigasi"`) is pushed right with `ml-auto`.

**Logout** (footer). `handleLogout` sets `loggingOut`, then
`fetch('/api/auth/logout', { method: 'POST' })`; on `response.ok` it does
`router.push('/login')` + `router.refresh()`; `catch` logs
`'Logout failed'`; `finally` clears the flag. The button is `disabled={loggingOut}`
and — a small a11y nicety — renders an *additional* `<span className="sr-only">`
with the text so the collapsed icon-only state still announces the action.

**Collapse control.** Rendered only when `variant === 'desktop' &&
onToggleCollapse`: a 40px round button at `absolute top-11 -right-5` with
`aria-pressed={isCollapsed}` and a label that flips between "Perlebar sidebar"
and "Perkecil sidebar" (`PanelLeftOpen` / `PanelLeftClose`). It is `absolute`
inside a root `<div>` that is *not* `relative` — it resolves against the
`fixed` `<aside>` rendered by the shell, which happens to give the intended
offset.

**Logout duplication:** `sidebar.tsx:88–101` and `topbar.tsx:51–64` contain
byte-identical `handleLogout` bodies and separate `loggingOut` state. Same
endpoint, same `push`/`refresh`, same `console.error('Logout failed')`. The two
also each own their own `useRouter()`. A shared hook would remove the copy.

### `topbar.tsx` — `Topbar`

Props: `{ user, onOpenDrawer, drawerOpen, menuButtonRef? }`.

`sticky top-0 z-30 flex h-15 … border-b border-border-subtle bg-surface-card/95
backdrop-blur` — a 60px translucent bar.

**Breadcrumb.** `(pathname ?? '').split('/').filter(Boolean).slice(1)` drops
the leading `admin` segment, because the root crumb is rendered separately as a
hard-coded `<Link href="/admin">Admin</Link>` (hidden below `sm`). Each remaining
segment is translated through a module-level
`const SEGMENT_LABELS: Record<string, string>` (`admin`, `teachers`,
`import-teachers`, `import`, `tsmanager`, `absensi`) with a
`?? segment` fallback for unknown paths, separated by `ChevronRight`, and the
last one gets `aria-current="page"` + `font-semibold text-text-primary`.

**Hamburger** (`lg:hidden`, 40px, `aria-expanded={drawerOpen}`,
`aria-label="Buka menu navigasi"`) forwards `menuButtonRef` to the shell so focus
can be restored after the drawer closes.

**Right cluster:** `<ThemeToggle />` then the account `Dropdown`
(`align="end"`). The `DropdownTrigger` is a custom 40px pill (not
`Button variant="ghost"`) containing `<Avatar size="sm" />` + the user's name
(`hidden sm:block`, `max-w-32 truncate`). The `DropdownContent` holds a
`DropdownLabel` with `user.email ?? user.name`, a `DropdownSeparator`, an
"Edit Profil" item routing to `/profile` (`router.push` + `router.refresh()`),
and a danger-styled "Keluar" item wired to `handleLogout`. The logout item keeps
the visible label plus `disabled={loggingOut}`.

## Integration Points

**Imports from the design system**
- `sidebar.tsx` → `Avatar` (`@/components/ui/avatar`)
- `topbar.tsx` → `Avatar`, `ThemeToggle`, and the six `Dropdown*` components
  (`@/components/ui/dropdown`)
- Neither imports `Button`, `Card`, `Badge`, `Table`, `Input`, `PageHeader`,
  `StatCard`, `Dialog`, `Skeleton` or `EmptyState`. Every interactive element
  here is a hand-written `<button className="focus-ring …">` rather than a
  `Button` — so button styling, `disabled:` handling, focus rings and
  `type="button"` defaults are re-implemented inline in three places. This is the
  single biggest adoption gap in the app: `button.tsx` exists and would cover
  most of these call sites.

**Icons** — `lucide-react` only, never FontAwesome `<i>`: `BookOpen`,
`BookOpenCheck`, `CalendarCheck`, `FileSpreadsheet`, `LayoutDashboard`, `LogOut`,
`PanelLeftClose`, `PanelLeftOpen`, `UserPlus`, `Users`, `X` (sidebar);
`ChevronRight`, `LogOut`, `Menu`, `User` (topbar). `type LucideIcon` from
`lucide-react` types the `NavItem.icon` field. No `data-feather` markup exists
anywhere under `src/app/admin/` or here, and `@/components/scripts` no longer
runs a Feather `replace()` pass — Feather is gone app-wide and `Scripts` now
only applies the SweetAlert2 palette.

**Navigation targets** — the sidebar covers 6 of the 7 admin routes; only
`/admin` is a root. `topbar.tsx` additionally routes to `/profile` and `/login`.
`/admin/teachers` is reachable from the sidebar and topbar breadcrumb, but
*not* from any link inside the admin pages themselves.

**CSS consumed** — the `[data-ds-shell]` block in `src/app/globals.css`
(lines 274–288) is load-bearing here: `background-color: var(--ds-surface-canvas)`,
`color: var(--ds-text-primary)`, `font-family: var(--font-nunito-sans)`,
`font-size: 0.875rem`, `min-height: 100dvh`, `scrollbar-color`, and the
`.dark [data-ds-shell]` `color-scheme` flip. `shell.tsx:137` puts
`data-ds-shell` on its root, which also picks up the scoped utility classes
`.focus-ring`, `.eyebrow`, `.meta`, `.prose-block`, `.text-display`,
`.action-row`, the `h1`/`h2`/`h3` tightening and the reduced-motion override.
There is no legacy `admin-shell` class and no temporary bridge block any more —
globals.css ends with a "REMOVED IN THE DS v2 MIGRATION" note (lines 487–499)
recording that the Bootstrap-parity and brutalist layers were deleted after
every page was migrated. Motion tokens `--ds-ease` and `--ds-duration-slow`
come from `:root`.

**Not used** — `@/components/toast-provider` is mounted in the root
`src/app/layout.tsx`, so `useToast()` *is* available to this subtree, but no
admin file calls it. `@/components/navbar` and `@/components/mobile-nav` no
longer exist (both deleted); the teacher chrome that replaced them is
`teacher-shell.tsx` → `app-shell.tsx`, mounted by
`src/app/(dashboard)/layout.tsx` along with `<Scripts />`. `src/app/admin/`
routes are wrapped by `AdminShell` instead and mount no `Scripts`.

**Route Handlers** — `POST /api/auth/logout` is the only one this folder talks
to, and it is called from two places.
