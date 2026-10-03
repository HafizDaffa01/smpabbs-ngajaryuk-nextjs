# src/components/ui/

The design-system primitives for the **admin shell** ("SaaS dashboard", light
default + dark toggle). Pure presentational components built on `cva` +
`twMerge(clsx(...))` (`cn` in `src/lib/utils.ts`). Every colour, radius, shadow
and motion value comes from a `--ds-*` token bridged into Tailwind v4 by the
`@theme inline` block in `src/app/globals.css` (lines 165–255). There are **no
raw hex values** in this folder.

Layout + routing of the shell itself: `src/app/admin/codemap.md`.
Shell components: `src/components/admin/codemap.md`.

---

## Is this genuinely shadcn/ui?

**No. It is a hand-rolled lookalike that borrows two shadcn idioms
(`cva` + `cn()`), and is missing the three markers that make shadcn
shadcn.** Verified against the tree:

| shadcn convention | Present? | Evidence |
|---|---|---|
| `components.json` | **No** | `find . -name components.json -not -path "*/node_modules/*"` returns nothing. The CLI cannot add/update these components. |
| `@radix-ui/*` primitives | **No** | No `@radix-ui` in `package.json` deps; zero `@radix-ui` imports in `src/`. `dropdown.tsx` and `dialog.tsx` implement their own behaviour. |
| `data-slot` attributes | **No** | `grep -rn "data-slot" src/` returns zero hits. The one slot-adjacent idea is a comment: `button.tsx:93` — *"Anchor styled as a button — `asChild` equivalent without a slot library."* |
| `React.forwardRef` | **No** | `grep -rln "forwardRef" src/` returns nothing. Every component is a plain function. This is React 19-legal (refs pass as props) but means none of these accept a caller-supplied `ref` — relevant for `Dialog` and `Dropdown`, which hide their refs internally. |
| `cva` + `VariantProps` | **Yes** | `button`, `badge`, `avatar`, `dialog`, `stat-card`. |
| `cn()` from `clsx` + `twMerge` | **Yes** | `src/lib/utils.ts` — `twMerge(clsx(inputs))`, and the documented contract `cn('px-2','px-4') -> 'px-4'`. |
| `tw-animate-css` / `tailwindcss-animate` | **No** | Absent from `package.json`. Animation is `animate-pulse`, `animate-spin`, and `transition-*` utilities only. |

The variant names also diverge from shadcn: `badge.tsx` uses
`success/info/warning/danger/neutral/accent` (shadcn: `default/secondary/
destructive/outline`), and `button.tsx` uses `primary/secondary/ghost/subtle/
danger` (shadcn: `default/secondary/ghost/outline/link/destructive/inline`).
That is the intended consequence of a token-driven design system — semantic
status ramps (`--ds-danger-text`, `--ds-warning-bg`, …) have no shadcn
equivalent.

**Practical consequence:** treat these as *local* primitives. Do not expect
`npx shadcn add …` to coexist, and do not port a shadcn component in without
first reconciling `components.json`, the variant vocabulary, and the
`[data-ds-shell]` CSS scoping (below).

---

## The `[data-ds-shell]` scoping trap (read this before reusing a primitive)

`globals.css` defines the shared utility classes this folder leans on **only
inside a design-system shell**. The scoping hook is the `[data-ds-shell]`
attribute, carried by both shell roots — `src/components/admin/shell.tsx:137`
and `src/components/app-shell.tsx:194`. The old `.admin-shell` class is gone
from both.

- `[data-ds-shell] .focus-ring:focus-visible` (globals.css:337)
- `[data-ds-shell] .eyebrow` (globals.css:310)
- `[data-ds-shell] .meta` (globals.css:320)
- `[data-ds-shell] .prose-block` (globals.css:291)
- `[data-ds-shell] .action-row > *` mobile `min-height:44px` (globals.css:331)

Each of those class names occurs **exactly once** in `globals.css`, always under
the `[data-ds-shell]` ancestor. `[data-ds-shell]` itself (globals.css:274–284)
sets the shell base: `background-color: var(--ds-surface-canvas)`,
`color: var(--ds-text-primary)`, `font-size: 0.875rem` (14px, for dense tables
and forms), `min-height: 100dvh` and themed `scrollbar-color`. `.dark
[data-ds-shell]` (globals.css:286) flips `color-scheme`.

**Colour tokens are fine everywhere** — `--ds-surface-*`, `--ds-border-*`,
`--ds-text-*`, `--ds-accent-*` are declared on `:root` (globals.css:19) and
overridden on `.dark` (globals.css:104), so `bg-surface-card` /
`text-text-primary` / `dark:` styling resolves on any route. The Tailwind
utilities in `@theme inline` are not scoped either, and the document canvas is
token-driven on `body` itself (globals.css:165–172).

**But the five utility classes above are inert outside `[data-ds-shell]`.**
Concretely:

- `button.tsx`, `dropdown.tsx` (`DropdownItem`), and every hand-written
  interactive element in `src/components/admin/` put `focus-ring` on the
  element. Rendered on a route with no shell the focus ring silently
  disappears.
- `stat-card.tsx` (`label`), `dropdown.tsx` (`DropdownLabel`), `table.tsx`
  (`TableHead`) use `eyebrow`; `dropdown.tsx` (`DropdownItem hint`) uses `meta`;
  `page-header.tsx` uses `prose-block` and `action-row`.

This is invisible today because the live consumers sit inside a shell, but it
becomes a real bug the moment `EmptyState`, `StatCard`, `Table`, `Input`,
`Badge` or `Dialog` is adopted outside one. Either promote those five rules to
global scope or keep the primitives shell-bound on purpose.

**Which routes have no shell.** `src/app/error/`, `src/app/success/`,
`src/app/unauthorized/` and `src/app/login/` render on `<body>` and never
carry `[data-ds-shell]` — `login` sits outside the `(dashboard)` route group
entirely. Components used in those contexts need token-native
`focus-visible:outline-*` utilities instead of `focus-ring`. The trap survives
the migration; only the selector changed.

For reference, teacher chrome is `(dashboard)/layout.tsx` → `TeacherShell` →
`AppShell` → `TeacherNav`, so every `(dashboard)` route *is* inside a shell.
Admin chrome is `admin/layout.tsx` → `components/admin/{shell,sidebar,topbar}.tsx`.

---

## Inventory

| File | Exports | `'use client'`? | Uses `cva`? | Live importers |
|---|---|---|---|---|
| `avatar.tsx` | `Avatar`, `getInitials` | no | yes (`size`) | `admin/sidebar.tsx`, `admin/topbar.tsx` |
| `bar-chart.tsx` † | `BarChart`, `type BarDatum` | yes | no | `admin/dashboard-client.tsx` |
| `badge.tsx` | `Badge`, `badgeVariants` | no | yes (`variant`) | **none** |
| `button.tsx` | `Button`, `ButtonLink`, `buttonVariants` | no | yes (`variant`, `size`) | `ui/dialog.tsx` only (no page) |
| `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | no | no | `ui/stat-card.tsx`, `ui/skeleton.tsx` only |
| `dialog.tsx` | `Dialog` | **yes** | yes (`size`) | **none** |
| `dropdown.tsx` | `Dropdown`, `DropdownTrigger`, `DropdownContent`, `DropdownItem`, `DropdownLabel`, `DropdownSeparator` | **yes** | no | `admin/topbar.tsx` |
| `dropzone.tsx` † | `Dropzone` | yes | no | `admin/import/import-form.tsx`, `admin/import-teachers/teacher-import-form.tsx` |
| `empty-state.tsx` | `EmptyState` | yes (unnecessary) | no | **none** |
| `feedback-banner.tsx` † | `FeedbackBanner`, `type FeedbackTone` | yes | no | 6 files under `admin/` |
| `input.tsx` | `Input`, `Textarea`, `Select`, `Label`, `Field` | yes (unnecessary) | no | **none** |
| `page-header.tsx` | `PageHeader`, `type Crumb` | no | no | **none** |
| `skeleton.tsx` | `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonTable` | yes (unnecessary) | no | **none** |
| `stat-card.tsx` | `StatCard`, `type TrendTone` | no | yes (`tone`, internal) | **none** |
| `swal-theme.ts` † | `themedSwal`, `useSwalTheme`, `readDsToken` | yes | no | `components/scripts.tsx`, `admin/dashboard-client.tsx` |
| `table.tsx` | `Table`, `TableCaption`, `TableScroll`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | no | no | **none** |
| `theme-toggle.tsx` | `ThemeToggle`, `Theme`, `THEME_STORAGE_KEY`, `DEFAULT_THEME` | **yes** | no | `admin/topbar.tsx` |

† Added by the `/admin` design-system migration on 2026-09-30, together with three
signature changes to existing primitives: `CardTitle` gained `as?: 'h2' | 'h3'`,
`PageHeader`'s `title`/`description` now accept `ReactNode` (the dashboard puts the
live `#greeting` node inside the description), and `StatCard`'s value wrapper became a
`<div>` so it can hold a `Skeleton` while loading.

`swal-theme.ts` deserves a note: SweetAlert2 mounts its popup on `<body>`, i.e.
**outside** `[data-ds-shell]`, so it cannot inherit the shell cascade and has to be
themed imperatively from `--ds-*`. `Swal.setDefaults()` — what
`design-improvements.md` §1.1 asks for — **no longer exists in sweetalert2 v11.26**
(only `mixin` is exported), so the equivalent is `Swal.mixin()`, memoised per theme
and rebuilt on `.dark` class changes. Popup body markup is styled by the `.ny-pop*`
rules in `src/app/globals.css`, which resolve against `:root`/`.dark` for the same
reason.


### Which primitives are actually used? (grep-verified)

The whole folder is now live. Every primitive is imported by at least one
non-`ui/` file — there is no dead code left:

| Primitive | Imported by (representative, not exhaustive) |
|---|---|
| `avatar` | `admin/topbar.tsx:8`, `admin/sidebar.tsx:21`, `app-shell.tsx:18`, `(dashboard)/profile/page.tsx:5` |
| `badge` | `period-badge.tsx:5`, `app-shell.tsx:19`, `attendance-grid.tsx:5`, `kbm-editor.tsx:9`, `(dashboard)/page.tsx:14` |
| `button` | `logout-button.tsx:7`, `kbm-editor.tsx:10`, `login-form.tsx:7`, `error/page.tsx:6`, `success/page.tsx:6`, `unauthorized/page.tsx:5` |
| `card` | `journal/page.tsx:7`, `absensi-form.tsx:31`, `prevSmes/presensi/page.tsx:16`, `admin/page.tsx:24` |
| `dialog` | `kbm-editor.tsx:18` |
| `dropdown` | `admin/topbar.tsx:17`, `app-shell.tsx:27` |
| `empty-state` | `attendance-grid.tsx:6`, `kbm-editor.tsx:19`, `journal-form.tsx:25`, `absensi-form.tsx:32` |
| `feedback-banner` | `journal-form.tsx:26`, `schedule/import-form.tsx:8`, `login-form.tsx:8` |
| `input` | `attendance-grid.tsx:7`, `journal/page.tsx:8`, `explorer/page.tsx:15`, `admin/page.tsx:16` |
| `page-header` | `journal/page.tsx:5`, `absensi/page.tsx:5`, `explorer/page.tsx:16`, `admin/page.tsx:15` |
| `skeleton` | `schedule/page.tsx:7`, `schedule-browser.tsx:19`, `explorer/page.tsx:17`, `absensi-form.tsx:35` |
| `stat-card` | `prevSmes/presensi/page.tsx:9` |
| `table` | `attendance-grid.tsx:17`, `schedule-browser.tsx:29`, `admin/page.tsx:17` |
| `theme-toggle` | `admin/topbar.tsx:9`, `app-shell.tsx:20`, `login/page.tsx:12` |
| `dropzone` | `schedule/import-form.tsx:7` |
| `bar-chart` | `prevSmes/presensi/page.tsx:8` |

`Card` is additionally imported internally by `stat-card.tsx` and
`skeleton.tsx`; `Button` internally by `dialog.tsx`.

### The `skeleton` / `empty-state` duplication is resolved

There is exactly one empty-state implementation. The hand-rolled `.empty-state`
CSS class and its `.empty-state i` / `.empty-state p` rules were part of the
deleted Bootstrap-parity layer in `src/app/globals.css`; the token-driven
`EmptyState` component is now the only one, and all former call sites use it.

Same for loading: every former `Memuat data...` text block is now a `Skeleton`
or `SkeletonTable`.

---

## Design

### Composition / prop-extraction pattern

No component in this folder composes via children slots except `Dialog`
(`footer`), `PageHeader` (`actions`, `crumbs`), `EmptyState` (`action`) and
`Field` (render-prop). The dominant pattern is the flat Tailwind wrapper:

```tsx
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap items-center …', className)} {...props} />
}
```

`className` is always extracted and passed as the **last** argument to `cn()`,
so `tailwind-merge` lets the caller's utility win (`cn` semantics). Native
attributes are spread through `{...props}` with **no `forwardRef`**, so callers
cannot attach a `ref`.

### `cva` variant systems

- **`button.tsx` → `buttonVariants`** — 2 axes. `variant`: `primary`
  (`bg-accent text-on-accent`, hover/active on `--accent-hover/-active`),
  `secondary` (`border-border-default bg-surface-card`), `ghost` (transparent,
  hover `bg-surface-hover`), `subtle` (`bg-surface-sunken`), `danger`
  (`border-danger-text bg-danger-text text-white` + `hover:brightness-95`).
  `size`: `sm` `h-8` (32px), `md` `h-9` (36px), `lg` `h-11` (44px), `icon`
  `h-10 w-10` (40px), `icon-lg` `h-11 w-11` (44px). Defaults
  `primary`/`md`. Base includes `focus-ring`, `rounded-sm`, and
  `disabled:pointer-events-none disabled:opacity-55`.
- **`badge.tsx` → `badgeVariants`** — 1 axis, `variant`:
  `success`/`info`/`warning`/`danger`/`neutral`/`accent`, each a
  `border-*-border bg-*-bg text-*-text` triple. Default `neutral`. Pill
  (`rounded-full`), `text-xs font-semibold whitespace-nowrap`.
- **`dialog.tsx` → `dialogSizes` (private, not exported)** — `size`:
  `sm` `max-w-sm`, `md` `max-w-lg`, `lg` `max-w-3xl`, `xl` `max-w-5xl`.
  Default `md`. Base is `w-[calc(100vw-2rem)] rounded-lg border border-border-subtle
  bg-surface-raised p-0 shadow-lg` — note `p-0`, because the children lay out
  their own padding.
- **`avatar.tsx` → `avatarVariants` (private)** — `size` only:
  `sm` `size-8 text-xs`, `md` `size-10 text-[13px]`, `lg` `size-12 text-sm`.
  Default `md`.
- **`stat-card.tsx` → `trendVariants` (private)** — `tone`:
  `positive` (`text-success-text`), `negative` (`text-danger-text`), `neutral`
  (`text-text-tertiary`). Default `positive`. The *tile* colour is a separate
  plain `const TILE_TONES` record (not `cva`) keyed
  `accent|info|success|warning|danger|neutral`; `tone` prop defaults `'accent'`.

### Deterministic colour from a name (avatar)

`hashName(name)` is a hand-rolled `hash*31 % 2147483647` loop
(avatar.tsx:18–24) and `TONES[hash % TONES.length]` picks one of six
`bg-*-bg text-*-text` pairs, so the same person always gets the same colour.
`getInitials(name)` is **exported** and separately testable: single word → first
2 chars upper-cased; otherwise first initial of the first and last token;
empty → `'?'`. `Avatar` defends the empty case with
`const safeName = name?.trim() || 'Pengguna'`.

`Avatar` renders `aria-hidden` with `title={title ?? safeName}` — i.e. the
avatar is decorative and the accessible name must come from adjacent text
(`sidebar.tsx` and `topbar.tsx` both render the name next to it).

### `Dialog` — native `<dialog>`, not Radix

`dialog.tsx:36–39` states the intent: focus trapping, background inertness and
Escape all come from the platform. A `useEffect` on `[open]` calls
`dialog.showModal()` / `dialog.close()`. `onClose` and `onCancel` both map to
`onOpenChange(false)`, so the platform → React direction is wired.
`React.useId()` supplies `titleId` / `descriptionId` for `aria-labelledby` /
`aria-describedby`; `aria-describedby` is omitted when there is no
`description`. The close affordance is a `Button variant="ghost" size="icon"`
with `aria-label="Tutup dialog"`, suppressed by `hideClose` for blocking
dialogs. Layout is `open:flex open:max-h-[calc(100dvh-2rem)] open:flex-col`
with a `flex-1 overflow-y-auto` body, so long content scrolls inside the modal.
Backdrop is `bg-black/45 backdrop-blur-[2px]`.

### `Dropdown` — hand-rolled compound component

`React.createContext<DropdownContextValue>` (`open`, `setOpen`, `triggerId`,
`menuId`) with a `useDropdown(component)` guard that throws
`` `${component} must be used inside <Dropdown>` ``. Unlike Radix, it does
**not** compose `Trigger` + `Portal` + `Content` into a single element — the
caller writes all four siblings inside `<Dropdown>`.

Behaviour implemented by hand:
- **Click-outside** — a `pointerdown` listener on `document`, closed when
  `rootRef.current` does not contain the target.
- **Escape** — closes and returns focus to `[data-dropdown-trigger]`.
- **Roving focus** — `DropdownContent` focuses the first `[role="menuitem"]`
  on open, then handles `ArrowDown`/`ArrowUp` (wrapping), `Home`, `End` and
  `Tab` (closes).
- **Keyboard open** — `ArrowDown` on the trigger opens the menu;
  `Enter`/`Space` on an item synthesises a `click()`.
- `DropdownItem` auto-closes on click and renders an optional right-aligned
  `hint` in the `meta` class.

Accessibility: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`,
`role="menu"`, `role="menuitem"`, `role="separator"`, `aria-labelledby` on
the content.

### `Field` — render-prop form wiring

`input.tsx:114` takes `children` as a **function** receiving
`{ id, 'aria-describedby', 'aria-invalid', 'aria-required' }`, and wires
`<Label htmlFor={id}>` to it. `describedBy` is `errorId` when there is an
error, else `hintId`, else `undefined` (error wins; the hint is then not
rendered at all). The error `<p role="alert">` is mutually exclusive with the
hint. `required` renders a `text-danger-text` `*` next to the label.
`Input`/`Textarea`/`Select` each take an `invalid?: boolean` prop that sets
`aria-invalid` and swaps `border-border-default` for `border-danger-text`.
`Select` is the only one that wraps in an extra `<div className="relative">` to
host the absolutely-positioned `ChevronDown`.

### `Table` — sticky header contract

`TableHead` is `eyebrow sticky top-0 z-10 bg-surface-sunken`, and the file's own
doc comment states the contract: *"Pair with `<TableBody maxHeight>`"* (this is
a doc typo — the scroll container is `TableScroll`, not `TableBody`).
`TableScroll` branches: without `maxHeight` it is a plain
`overflow-x-auto` wrapper; with `maxHeight` it becomes `overflow-auto` plus
`style={{ maxHeight }}`, `tabIndex={0}`, `role="group"` and a default
`aria-label="Tabel data"` so the scroll region is reachable by keyboard. All
seven table pieces are declared as module-local `function`s and exported in one
trailing `export { … }` block (not `export function`). `Table` sets
`border-collapse` + `border-spacing-0` + `tabular-nums`; zebra striping is
deliberately absent. `TableRow` adds `focus-within:bg-surface-hover`.

### `theme-toggle.tsx` — theme handling

Full detail in the duplication note below. Mechanism: the `.dark` class on
`<html>` is the single source of truth, read back through
`React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`.
- `getSnapshot()` reads `document.documentElement.classList.contains('dark')`.
- `getServerSnapshot()` returns `DEFAULT_THEME` (`'light'`), which is what
  keeps the first client render identical to the server HTML (no hydration
  mismatch) while the post-hydration subscription re-syncs to the real theme.
- `setTheme(theme)` toggles the class, writes `localStorage['theme']` inside a
  `try/catch` (private mode → the class still applies), and dispatches a
  `CustomEvent`-style `Event(THEME_EVENT)` on `window` (`'ngajaryuk:theme-change'`)
  to notify the store. This is the standard "external store" pattern; the event
  name is **local to this file** and not shared.
- Product decision, stated in a comment at line 11: **light is the default and
  the OS preference is deliberately NOT followed.** `globals.css:6` backs this
  with `@custom-variant dark (&:where(.dark, .dark *))`, overriding Tailwind
  v4's OS-preference default.
- The button is a 40×40 `focus-ring` square whose `aria-label` *and* `title` are
  the inverse action ("Aktifkan mode gelap" / "Aktifkan mode terang"), showing
  `Moon` in light and `Sun` in dark.

---

## Q: Does `theme-toggle.tsx` exist in TWO places?

**The component exists once. The *logic* is duplicated in two places**, and
`src/app/layout.tsx:22` says so explicitly:

```ts
// src/app/layout.tsx:19-24
/**
 * Applies the persisted theme before first paint so there is no flash of the
 * wrong colour scheme. Light is the default; the OS preference is not used.
 * Mirrors the logic in `src/components/ui/theme-toggle.tsx`.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;
```

and it is injected as a **blocking** inline script inside `<head>`
(`layout.tsx:43`, `dangerouslySetInnerHTML`) with the comment
`{/* Blocking: runs while the HTML is parsed, before the first paint. */}`.

### What is duplicated

Three things, all encoded twice and kept in sync **by hand**:

| Fact | `theme-toggle.tsx` | inline `themeScript` |
|---|---|---|
| Storage key `'theme'` | `export const THEME_STORAGE_KEY = 'theme'` (line 9) | string literal `'theme'` inside the IIFE |
| Light is the default / OS not followed | `DEFAULT_THEME = 'light'` + comment (lines 11–12) | prose comment (lines 20–21) |
| Mechanism: toggle `.dark` on `document.documentElement` | `setTheme()` (lines 35–43) | `document.documentElement.classList.add('dark')` |

The two halves are asymmetric by necessity and by omission:

- **The script can only add `.dark`.** It never removes it, because at first
  paint `getServerSnapshot()` guarantees the server rendered light, so an
  absent-or-`light` value needs no class. It also has no `try/catch` *around the
  classList write* — the `try` wraps only the `localStorage` read.
- **The script does not dispatch `THEME_EVENT`.** It cannot: the store's first
  `getSnapshot()` reads the class directly after hydration, so the initial value
  is correct without an event.
- **`THEME_STORAGE_KEY` is not interpolated into the script.** The IIFE is a
  plain template string with no `${}`, so renaming the constant to anything else
  would silently break persistence for the pre-paint flash prevention while the
  toggle kept writing the new key. This is the sharpest edge in the pair.
- **The script is a string, so it cannot import the constant.** The fix, if the
  duplication ever needs to be removed, is to interpolate
  `${THEME_STORAGE_KEY}` into the IIFE (or move both halves into
  `src/lib/theme.ts` and import the constant from each side).

There is no third copy, and nothing else in the repo writes
`localStorage['theme']`.

---

## Data Flow

```
src/app/globals.css  --ds-* tokens (:root, .dark)
        │
        ├─ @theme inline  ──►  Tailwind utilities (bg-surface-card, text-text-tertiary, …)
        │                     used by every primitive in this folder
        │
        └─ [data-ds-shell] *  ──►  focus-ring / eyebrow / meta / prose-block / action-row
                                 (scoped; inert outside admin/ and (dashboard)/)

cn()  =  twMerge(clsx(...))        src/lib/utils.ts
  ▲
  └── used by all 13 primitives for className merging

use client (only where behaviour demands it)
  ├── dropdown.tsx   → context + document listeners + keyboard roving
  ├── dialog.tsx     → useRef + useId + showModal() effect
  └── theme-toggle.tsx → useSyncExternalStore + window event + localStorage

No data fetching anywhere in this folder. Zero Supabase, zero `fetch`,
zero props carrying domain objects. Every component is pure: props in, JSX out.
The only cross-component coupling is intra-folder:
dialog → button, stat-card → card, skeleton → card.
```

Server/client boundary: only the 3 interactive files are client components, so
everything else can be rendered inside RSC trees without a client boundary —
but note that `avatar`, `card`, `stat-card`, `table`, `input`, `badge`,
`page-header` are imported *by* a client component today (`admin/sidebar.tsx`,
`admin/topbar.tsx`), which drags them into the client graph regardless of their
own directives.

## Integration Points

**Imported by**
- `src/components/admin/sidebar.tsx` → `Avatar` (`@/components/ui/avatar`).
- `src/components/admin/topbar.tsx` → `Avatar`, `ThemeToggle`, and
  `Dropdown`/`DropdownTrigger`/`DropdownContent`/`DropdownItem`/`DropdownLabel`/
  `DropdownSeparator` from `@/components/ui/dropdown`.
- `src/components/ui/dialog.tsx` → `Button`; `stat-card.tsx` → `Card`;
  `skeleton.tsx` → `Card`.

**Imported by nobody** — `badge`, `dialog`, `empty-state`, `input`,
`page-header`, `skeleton`, `stat-card`, `table` (plus `button` and `card` in
practice, see the dead-chain note above). All remaining references to them in
the repo are prose in other `codemap.md` files.

**External dependencies used here**
- `class-variance-authority` (`cva`, `VariantProps`) — `button`, `badge`,
  `avatar`, `dialog`, `stat-card`.
- `lucide-react` — `Loader2` (button), `X` (dialog), `ChevronDown` (input),
  `Inbox` (empty-state), `TrendingUp`/`TrendingDown` (stat-card),
  `ChevronRight` (page-header), `Moon`/`Sun` (theme-toggle). **No FontAwesome
  `<i>` anywhere in this folder** — the admin pages still use `<i className="fas">`,
  so the two icon systems coexist.
- `next/link` — `button.tsx` (`ButtonLink`), `page-header.tsx` (crumb links).
- `clsx` + `tailwind-merge` — only via `cn`.

**Consumed CSS / tokens** — the `--ds-*` families in use: `--color-surface-*`
(canvas/card/raised/sunken/hover), `--color-border-*` (subtle/default/strong),
`--color-text-*` (primary/secondary/tertiary/disabled/inverse),
`--color-accent*` (incl. `-subtle`, `-subtle-text`, `-border`, `-hover`,
`-active`, `--color-on-accent`), and the four semantic status ramps
`success`/`info`/`warning`/`danger`/`neutral` (each `-bg`/`-text`/`-border`).
Radius via `--radius-sm/md/lg/full`; elevation via `--shadow-xs/sm/md/lg`.
Note `--shadow-focus` is bridged to `--ds-shadow-focus` (globals.css:263) but the
primitives reach it through the `[data-ds-shell] .focus-ring` rule
(globals.css:337), not as a `shadow-focus` utility.

**Verification / a11y invariants to preserve when editing**
- Icon-only buttons (`size="icon"` / `"icon-lg"`) must carry an `aria-label`.
- One `<h1>` per page — currently only `page-header.tsx` emits an `<h1>`, and it
  has no importers, so no page in the repo has a shell-provided `<h1>`.
- `getInitials` and `TONES`/`hashName` must stay deterministic — a change to the
  hash reshuffles every avatar colour in the app.
- `className` must stay the last `cn()` argument, or caller overrides stop
  winning.
