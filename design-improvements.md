# NgajarYuk Design Improvement Plan

> **Scope**: Incremental, high-impact visual improvements for the NgajarYuk Next.js education app.
> **Constraint**: Do NOT rewrite the entire app. Focus on achievable changes that fix the most visible issues.

---

## 1. Quick Wins (Low Effort, High Impact)

These changes can be implemented in a single pass with minimal risk.

### 1.1 SweetAlert2 Dark Theme Override
**What**: SweetAlert2 modals currently render with white backgrounds, breaking the dark theme.
**Why**: The app uses a Laravel-inspired dark theme (`--dark-900` to `--dark-50`). White modals feel jarring and unpolished.
**Change**:
- Add a global SweetAlert2 dark theme configuration in `src/components/scripts.tsx` (or a new `src/components/sweetalert-theme.ts`).
- Override Swal defaults: background (`--dark-800`), title color (`--dark-50`), content color (`--dark-200`), confirm button color (`--primary`), popup border (`--dark-700`), popup shadow.
- Example Tailwind/CSS approach:
  ```css
  .swal2-popup {
    background-color: var(--bg-card) !important;
    border: 1px solid var(--border-color) !important;
    color: var(--text-main) !important;
  }
  .swal2-title { color: var(--text-heading) !important; }
  .swal2-html-container { color: var(--text-muted) !important; }
  .swal2-confirm { background-color: var(--primary) !important; }
  ```
- Call `Swal.setDefaults({ background: '...', color: '...' })` on app load.

### 1.2 Consistent Empty State Component
**What**: Replace scattered `fa-inbox` empty states with a reusable, polished component.
**Why**: Current empty states are minimal and inconsistent across pages (schedule, user table, etc.).
**Change**:
- Create `src/components/empty-state.tsx`:
  ```tsx
  export default function EmptyState({ icon, title, description }: { icon: string; title: string; description?: string }) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-soft flex items-center justify-center mb-4">
          <i data-feather={icon} className="w-8 h-8 text-primary-soft-text" />
        </div>
        <h3 className="text-lg font-bold text-heading mb-1">{title}</h3>
        {description && <p className="text-sm text-muted max-w-xs">{description}</p>}
      </div>
    )
  }
  ```
- Replace all inline empty state HTML with `<EmptyState icon="inbox" title="Tidak ada data" description="..." />`.
- Use Tailwind utilities instead of custom CSS classes where possible.

### 1.3 Loading Skeleton Component
**What**: Replace text-only loading states ("Memuat data...") with skeleton loaders.
**Why**: Skeleton loaders reduce perceived wait time and look significantly more polished.
**Change**:
- Create `src/components/skeleton-loader.tsx` with reusable skeleton patterns:
  - `CardSkeleton` - for page-level loading
  - `TableSkeleton` - for table loading (rows of shimmer blocks)
  - `StatsCardSkeleton` - for dashboard stats
- Use Tailwind `animate-pulse` with `bg-dark-700` rounded blocks.
- Example:
  ```tsx
  export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-4 bg-dark-700 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    )
  }
  ```
- Apply to: schedule page, admin dashboard, user table, journal page.

### 1.4 Login Page Visual Polish
**What**: Elevate the login page from a bare card to a branded experience.
**Why**: First impression matters. The current login is extremely minimal.
**Change**:
- Add a brand header above the card: NgajarYuk logo/icon, app name, and a short tagline.
- Add a subtle background pattern or gradient (e.g., `bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900`).
- Increase card padding and add a soft glow/shadow.
- Add a "Forgot password?" link styled as a subtle text link.
- Use the existing `--primary-soft` background for the icon wrapper.
- Example structure:
  ```tsx
  <div className="min-vh-100 flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 px-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="icon-wrapper mx-auto mb-4">
          <i className="fas fa-book-open" />
        </div>
        <h1 className="text-2xl font-extrabold text-heading">NgajarYuk</h1>
        <p className="text-muted">SMP ABBS Surakarta</p>
      </div>
      <div className="card p-6">
        {/* LoginForm */}
      </div>
    </div>
  </div>
  ```

### 1.5 Home Page Brand Presence
**What**: Strengthen visual hierarchy on the home page.
**Why**: The current home page is a centered card with limited brand presence and hierarchy.
**Change**:
- Add a top brand bar or subtle header inside the card with the app name and a small tagline.
- Increase the icon wrapper size slightly or add a subtle pulse animation on load.
- Improve typography hierarchy: make the welcome message bolder, reduce paragraph weight, add a subtle divider before the hadith section.
- Add hover effects to the CTA buttons (already partially present, but ensure consistency).
- Consider a subtle gradient border or top accent on the card.

---

## 2. Component Pattern Standardization (Medium Effort)

### 2.1 Reduce Bootstrap Dependency - Card Pattern
**What**: Standardize card usage by creating a reusable `AppCard` component.
**Why**: Currently cards are created via Bootstrap `.card` + custom CSS overrides. This creates inconsistency.
**Change**:
- Create `src/components/app-card.tsx`:
  ```tsx
  type AppCardProps = {
    children: React.ReactNode
    className?: string
    header?: React.ReactNode
    footer?: React.ReactNode
    hover?: boolean
  }
  export default function AppCard({ children, className = '', header, footer, hover }: AppCardProps) {
    return (
      <div className={`bg-card border border-border-color rounded-lg shadow-lg overflow-hidden ${hover ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-xl' : ''} ${className}`}>
        {header && <div className="px-6 py-4 border-b border-border-color bg-dark-800/30">{header}</div>}
        <div className="p-6">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border-color bg-dark-800/30">{footer}</div>}
      </div>
    )
  }
  ```
- Migrate high-traffic pages first: admin dashboard, schedule, user table.
- Keep Bootstrap `.card` for legacy pages during transition.

### 2.2 Button Standardization
**What**: Consolidate button variants into a single `AppButton` component.
**Why**: Multiple button classes exist (`.btn`, `.btn-primary`, `.btn-outline-custom`, `.btn-success`, etc.) with duplicated hover effects.
**Change**:
- Create `src/components/app-button.tsx`:
  ```tsx
  type AppButtonProps = {
    children: React.ReactNode
    variant?: 'primary' | 'success' | 'danger' | 'warning' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
    className?: string
    onClick?: () => void
    type?: 'button' | 'submit' | 'reset'
  }
  ```
- Map variants to Tailwind classes using the CSS variables.
- Use this component in new code and gradually migrate existing buttons.

### 2.3 Table Standardization
**What**: Create a reusable `AppTable` component.
**Why**: Tables across the app (schedule, user table) use Bootstrap `.table` with minor variations.
**Change**:
- Create `src/components/app-table.tsx`:
  ```tsx
  type Column<T> = { key: string; header: string; render?: (row: T) => React.ReactNode }
  type AppTableProps<T> = {
    data: T[]
    columns: Column<T>[]
    loading?: boolean
    emptyState?: { icon: string; title: string; description?: string }
    onRowClick?: (row: T) => void
  }
  ```
- Include built-in loading skeleton and empty state integration.
- Apply to schedule page and user table first.

---

## 3. Dark Theme Refinements (Medium Effort)

### 3.1 Subtle Depth & Atmosphere
**What**: Add visual depth beyond flat colors.
**Why**: The current dark theme is functional but flat. Subtle gradients and glows elevate the experience.
**Change**:
- Add a very subtle radial gradient to the body background:
  ```css
  body {
    background: radial-gradient(ellipse at top, var(--dark-800) 0%, var(--dark-900) 60%);
  }
  ```
- Add a subtle inner glow to cards on hover:
  ```css
  .card:hover {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.03);
  }
  ```
- Use `backdrop-blur` on the navbar and mobile nav for a glassmorphism effect.

### 3.2 Input & Form Polish
**What**: Improve form input styling consistency.
**Why**: Some inputs use `.form-control` (Bootstrap), others use `.search-box`, others use `.custom-input-group`.
**Change**:
- Consolidate to a single `.form-control` style (already well-defined in globals.css).
- Add a subtle transition on focus with a ring effect (already present, but ensure it's applied everywhere).
- Ensure select dropdowns have a custom arrow using the existing SVG data URI.
- Add floating labels or improved label styling for key forms (login, add user).

### 3.3 Navbar & Mobile Nav Polish
**What**: Elevate the top navbar and bottom mobile nav.
**Why**: Navigation is the most used UI element. It deserves more polish.
**Change**:
- **Top Navbar**:
  - Add a subtle bottom border with a gradient fade.
  - Increase brand icon size and add a subtle hover animation.
  - Style active nav links with a bottom indicator (2px primary color line) instead of just color change.
  - Add a subtle backdrop blur.
- **Mobile Bottom Nav**:
  - Increase active state prominence: add a small dot indicator above the icon or a filled background pill.
  - Add a subtle top border glow on the active item.
  - Increase icon size slightly and add a gentle bounce on tap.
  - Example active state:
    ```css
    .mobile-nav-link.active::before {
      content: '';
      position: absolute;
      top: 6px;
      width: 4px;
      height: 4px;
      border-radius: 9999px;
      background: var(--primary);
    }
    ```

---

## 4. Page-Specific Improvements (Medium Effort)

### 4.1 Admin Dashboard Stats Cards
**What**: Make stats cards more visually distinctive.
**Why**: The dashboard is the admin's primary view. Stats cards should communicate status at a glance.
**Change**:
- Add a subtle gradient accent on the left border of each stats card (4px wide, colored by type).
- Add a small trend indicator or sparkline area (optional, if data supports it).
- Ensure the card hover effect is smooth and consistent.
- Add a subtle icon background pattern (e.g., a large faded icon behind the stats number).

### 4.2 Schedule Page Table Polish
**What**: Make the schedule table feel modern, not like a default Bootstrap table.
**Why**: Tables are information-dense. Good table design improves scanability.
**Change**:
- Add zebra striping with very subtle opacity:
  ```css
  .table tbody tr:nth-child(even) { background-color: rgba(248, 250, 252, 0.02); }
  ```
- Add rounded corners to the table container and overflow hidden.
- Style the table header with a sticky position and backdrop blur.
- Add a subtle left border accent to the first column (class name) for visual grouping.
- Improve empty state integration (use the new `EmptyState` component).

### 4.3 Journal Form - Remove Inline Styles
**What**: Extract the `<style jsx global>` block from `journal-form.tsx` into `globals.css`.
**Why**: Inline styles in a component are technical debt. They also hardcode light-mode colors.
**Change**:
- Move all `.attendance-grid-container` styles to `globals.css`.
- Replace hardcoded light colors (`#f3f4f6`, `white`, `#d1d5db`) with CSS variables (`--bg-card`, `--border-color`, `--text-heading`).
- Remove the `<style jsx global>` block entirely.
- Ensure dark mode overrides use the existing `.dark` class pattern or just rely on CSS variables.

---

## 5. CSS Architecture Cleanup (Lower Priority, Higher Effort)

### 5.1 Audit and Remove Duplicate Classes
**What**: Clean up duplicate definitions in `globals.css`.
**Why**: `.btn-outline-custom` is defined twice (lines 323 and 503). `.card` and `.home-card` overlap.
**Change**:
- Remove duplicate `.btn-outline-custom` definition.
- Merge `.home-card` into the base `.card` style or remove it if no longer needed.
- Remove any other unused or redundant classes.

### 5.2 Migrate Custom CSS to Tailwind Utilities
**What**: Gradually replace custom CSS classes with Tailwind utilities.
**Why**: Reduces CSS bundle size and improves consistency.
**Change**:
- Identify classes that are simple one-off styles (e.g., `.text-primary-bold` → `text-primary-soft-text font-bold`).
- Replace in pages where feasible.
- Keep complex component styles (cards, buttons, tables) in `globals.css` for now.

### 5.3 Loading State Standardization
**What**: Create a global loading overlay or skeleton pattern.
**Why**: Currently loading states are ad-hoc text or inline spinners.
**Change**:
- Create `src/components/loading-overlay.tsx` for full-page or section loading.
- Create `src/components/skeleton-card.tsx` for card-level loading.
- Use these consistently across all pages.

---

## 6. Implementation Priority Matrix

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | SweetAlert2 dark theme | Low | High |
| P0 | Empty state component | Low | High |
| P0 | Login page polish | Low | High |
| P0 | Loading skeletons | Low-Medium | High |
| P1 | Home page brand presence | Low | Medium |
| P1 | Mobile nav polish | Low | Medium |
| P1 | Journal form inline styles removal | Medium | Medium |
| P1 | AppCard component | Medium | Medium |
| P2 | Admin dashboard stats polish | Medium | Medium |
| P2 | Schedule table polish | Medium | Medium |
| P2 | Dark theme depth refinements | Medium | Medium |
| P2 | Button standardization | Medium | Medium |
| P3 | CSS audit & deduplication | Low | Low |
| P3 | Tailwind migration | High | Low |

---

## 7. Recommended Execution Order

1. **SweetAlert2 dark theme** - One file change, immediate visual fix.
2. **EmptyState component** - One new component, replace 3-4 instances.
3. **Login page polish** - One file change, strong first impression.
4. **Skeleton loaders** - One new component, apply to 3-4 pages.
5. **Home page brand presence** - One file change.
6. **Mobile nav polish** - CSS changes in `globals.css`.
7. **Journal form inline styles** - Move CSS, update variables.
8. **AppCard component** - New component, migrate admin dashboard.
9. **Admin dashboard stats** - CSS refinements.
10. **Schedule table** - CSS refinements + EmptyState integration.
11. **Dark theme depth** - CSS refinements in `globals.css`.
12. **AppButton component** - New component, gradual migration.
13. **CSS audit** - Cleanup pass.

---

## 8. Technical Notes

- **Bootstrap CDN**: Keep Bootstrap loaded for now. The goal is to reduce dependency, not remove it immediately. Removing Bootstrap would require rewriting many components and is out of scope for this plan.
- **Feather Icons**: Continue using Feather Icons. They fit the clean aesthetic well.
- **Font**: Nunito Sans is already a good choice. Keep it.
- **CSS Variables**: All design tokens are already well-defined in `:root`. Use them consistently.
- **Tailwind v4**: The project uses Tailwind v4 with `@theme inline`. Ensure any new utility classes are compatible.
- **Next.js 16**: Be aware of breaking changes. The current codebase appears stable.

---

## 9. Success Criteria

- All SweetAlert2 modals match the dark theme.
- No page uses text-only loading states.
- Empty states are consistent across the app.
- Login page feels branded and welcoming.
- Mobile nav active state is clearly visible.
- Journal form has no inline `<style>` tags.
- No duplicate CSS class definitions in `globals.css`.
