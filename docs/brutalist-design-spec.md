# NgajarYuk — Brutalist Design Specification

> **Purpose:** This document defines the complete brutalist design system for every page type in the NgajarYuk Next.js application. It is grounded in the existing brutalist tokens already present in `src/app/globals.css` and the patterns already used on the dashboard welcome page and mobile nav.

---

## 1. Design Tokens & Global Rules

All brutalist pages share these core tokens (already in `globals.css`):

```css
--accent: #10b981;
--accent-soft: rgba(16, 185, 129, 0.15);
--accent-soft-text: #34d399;
--border-brutal: 2px solid var(--dark-400);
--radius-brutal: 0px;
--radius-brutal-sm: 2px;
--shadow-brutal: 4px 4px 0px rgba(0, 0, 0, 0.5);
--shadow-brutal-hover: 6px 6px 0px rgba(0, 0, 0, 0.6);
```

**Hard rules for brutalist pages:**
- `border-radius: 0` (or `2px` for small badges)
- Hard offset shadows, never soft diffuse shadows
- Uppercase labels with wide letter-spacing
- Monospace fonts for metadata/labels
- No rounded avatars or rounded icons
- Hover states must shift the element and increase shadow offset

---

## 2. Layout Strategy

### Route Groups

| Route Group | Layout | Navbar | Mobile Nav | Brutalist Theme |
|-------------|--------|--------|------------|-----------------|
| `/` (root) | None | None | None | N/A — redirects |
| `/(dashboard)/` | `layout.tsx` | Modern glass-morphism | Brutalist bottom nav | **Yes** |
| `/login` | **None** (standalone) | None | None | **Auth-specific** |
| `/unauthorized` | **None** (standalone) | None | None | **Auth-specific** |
| `/error` | **None** (standalone) | None | None | **Auth-specific** |
| `/success` | **None** (standalone) | None | None | **Auth-specific** |

**Decision:** Auth pages (`/login`, `/unauthorized`, `/error`, `/success`) use a **separate, minimal layout** without the dashboard navbar. They are standalone full-viewport centered cards. All other authenticated pages live under `/(dashboard)/` and inherit the navbar + mobile bottom nav.

---

## 3. Existing Brutalist Classes (Reference)

| Class | Purpose |
|-------|---------|
| `.card-brutalist` | Hard border, hard shadow, no radius, hover lift |
| `.card-brutalist-header` | Gradient header with left accent bar |
| `.card-brutalist-body` | Padded body |
| `.btn-brutalist` | Primary button, uppercase, hard shadow, press animation |
| `.btn-brutalist-outline` | Outline button, same brutalist treatment |
| `.hadith-brutalist` | Hadith card with left accent border |
| `.hadith-brutalist-label` | Monospace label badge |
| `.status-bar` | Status indicator with pulsing dot |
| `.section-label` | Section header label |
| `.divider-brutalist` | Dashed divider |
| `.navbar-modern` | Glass-morphism navbar |
| `.nav-link-modern` | Nav links with underline animation |
| `.mobile-bottom-nav-brutalist` | Mobile bottom nav |
| `.mobile-nav-link-brutalist` | Mobile nav links |

---

## 4. Page-Type Specifications

### 4.1 Auth Pages (Login, Unauthorized)

**Layout:** Standalone, no navbar, no mobile nav. Full viewport centered.

**Card:**
- Use `.card-brutalist` for the main card
- Max width: `28rem` (448px)
- Header: `.card-brutalist-header` with centered brand icon + title
- Body: `.card-brutalist-body`

**Login Card Specifics:**
- Brand icon: 56×56px square, `border-radius: 2px`, gradient background, hard shadow
- Title: `font-weight: 900`, `letter-spacing: -0.02em`
- Subtitle: muted, small
- Form inputs: **brutalist form style** (see Section 6)
- Submit button: `.btn-brutalist` full width
- Links (e.g., "Forgot password?"): small, uppercase, monospace

**Unauthorized Card Specifics:**
- Same `.card-brutalist` structure
- Icon: 64×64px, `border-radius: 2px`, danger color background
- Title: `text-danger`, `font-weight: 900`
- Message: centered, muted
- Button: `.btn-brutalist` or `.btn-brutalist-outline` linking back to `/`

**Error/Success pages** follow the same pattern as Unauthorized but with appropriate accent colors (danger for error, success for success).

---

### 4.2 Admin Dashboard (`/admin`, `/admin/dashboard-client.tsx`)

**Layout:** Under `/(dashboard)/`, uses navbar + mobile nav.

**Page Header:**
- Use `.dashboard-header` (existing class)
- Left: greeting + description
- Right: live clock + date in `.time-info`
- Add `.section-label` above the header: `ADMIN_DASHBOARD`

**Stats Cards:**
- Use existing `.stats-card` + `.bg-*-light` pattern
- Each card: clickable, hover lift + colored border glow
- Icon: 56×56px, `border-radius: 2px`, soft background, hard shadow on hover
- Label: uppercase, `font-size: 0.75rem`, `letter-spacing: 0.06em`
- Value: `font-size: 2.25rem`, `font-weight: 800`
- Footer hint: `font-size: 0.8rem`, colored text

**Users Section:**
- Outer wrapper: `.card-brutalist`
- Header: `.card-brutalist-header` with `.section-label` + title
- Search: brutalist input (see Section 6)
- Table: `.table-brutalist` (new class — see Section 7)
- Action cards (Import Siswa, Import Guru, etc.): `.card-brutalist` with `.btn-brutalist-outline` links

---

### 4.3 Journal Pages (`/journal`, `/journal/show`)

**Class Selector (`/journal`):**
- Full viewport centered
- Card: `.card-brutalist`, max-width `480px`
- Header: centered icon (70×70px, `border-radius: 2px`) + title
- Form: `.form-select` with brutalist styling
- Submit: `.btn-brutalist` full width

**Journal Show (`/journal/show`):**
- Outer: `.card-brutalist`
- Header: `.card-brutalist-header` with class name + date + back button (`.btn-brutalist-outline`)
- Body: `.card-brutalist-body`
- Sections inside body:
  - Attendance grid: `.table-brutalist`
  - Notes section: `.card-brutalist` per day with `.hadith-brutalist` for individual notes
  - Subject tabs: `.btn-brutalist-outline` active state with accent border

---

### 4.4 Schedule Pages (`/schedule`, `/schedule/import`)

**Schedule Table (`/schedule`):**
- Outer: `.card-brutalist`
- Header: `.card-brutalist-header` with `.section-label` "JADWAL_MENGAJAR"
- Filters: brutalist form selects + `.btn-brutalist` submit
- Table: `.table-brutalist` with sticky header
- Columns: Kelas, Hari, Periode, Mapel, Guru, Waktu
- Empty state: `.empty-state` with icon

**Import Page (`/schedule/import`):**
- Outer: `.card-brutalist`
- Header: `.card-brutalist-header`
- Upload zone: dashed border, `border-radius: 0`, centered text
- Buttons: `.btn-brutalist` for upload, `.btn-brutalist-outline` for cancel
- Results table: `.table-brutalist`

---

### 4.5 Attendance / Absensi (`/absensi`, `/admin/absensi`)

**User Attendance (`/absensi`):**
- Full viewport centered, max-width `600px`
- Card: `.card-brutalist`
- Header: gradient background, clock + date display
- Greeting: centered, warning icon
- Form: brutalist inputs for location + notes
- Camera section: bordered area, `border-radius: 0`
- Submit: `.btn-brutalist` full width
- Status result: `.status-card` (success) or `.status-card-error` with icon wrapper

**Admin Backup Absensi (`/admin/absensi`):**
- Outer: `.card-brutalist`
- Header: `.card-brutalist-header` with back button
- Filter bar: year + month selects + `.btn-brutalist`
- Teacher grid: each teacher is a `.card-brutalist` with status indicators
- Status dots: `.status-bar` with `.status-bar-dot`
- Summary cards at top: `.stats-card` with accent colors

---

### 4.6 Export / Backup (`/export`, `/export/backup-client.tsx`)

**Outer:**
- `.card-brutalist`
- Header: `.card-brutalist-header` with `.section-label` "BACKUP_DATA"
- Filter form: brutalist selects + `.btn-brutalist` filter button
- Export buttons row: `.btn-brutalist` (primary), `.btn-brutalist-outline` (secondary)

**Waktu Tab (editable grid):**
- Table: `.table-brutalist` with `table-layout: fixed`
- Sticky columns: first (No) and last (TOT) with `position: sticky`
- Editable cells: click to reveal `<input type="time">` with brutalist input style
- Controls: `.btn-brutalist` save, `.btn-brutalist-outline` sort, autosave toggle

**Lokasi Tab:**
- Table: `.table-brutalist`
- Columns: Nama, Lokasi (GPS), Alamat, Waktu, Akurasi

**Gambar Tab:**
- Grid: each teacher gets a `.card-brutalist` with image thumbnails
- Images: `border-radius: 0`, hard border, cursor pointer

---

### 4.7 Profile (`/profile`, `/profile/profile-form.tsx`)

**Outer:**
- Full viewport centered, max-width `42rem`
- Card: `.card-brutalist`
- Header: `.card-brutalist-header` centered with avatar

**Avatar:**
- 80×80px, `border-radius: 0`, hard border, accent background
- Status dot: 16×16px, `border-radius: 0`, success color

**Input Groups:**
- Use `.custom-input-group` (existing) but add `border-radius: 0` and `border: 2px solid var(--border-color)`
- Icon box: 44×44px, `border-radius: 0`
- Lock icon for disabled fields

**Forms:**
- Each section (Update Profil, Update Password) is a `.card-brutalist`
- Section header: `.section-label` inside `.card-brutalist-header`
- Submit: `.btn-brutalist`
- Error alerts: `.alert-error-custom` with `border-radius: 0`

---

### 4.8 Rekap Semester (`/prevSmes`, `/prevSmes/show`, `/prevSmes/presensi`)

**Selector (`/prevSmes`):**
- Full viewport centered, max-width `56rem`
- Two cards side by side (responsive):
  - `.card-brutalist` for "Rekap KBM"
  - `.card-brutalist` for "Rekap Presensi"
- Each card: icon (64×64px, `border-radius: 2px`), title, description, form select, `.btn-brutalist` submit

**Show (`/prevSmes/show`):**
- Outer: `.card-brutalist`
- Header: `.card-brutalist-header` with back button + view toggle (Semester/Harian)
- KBM section: each day is a `.card-brutalist` with `.card-brutalist-body`
- Absensi section: each day is a `.card-brutalist` with student list
- Date picker: brutalist input

**Presensi (`/prevSmes/presensi`):**
- Outer: `.card-brutalist`
- Header: `.card-brutalist-header` with view toggle (Semester/Bulanan)
- Table: `.table-brutalist` with `table-layout: fixed`
- Sticky first column (Nama Siswa)
- Month columns with colored badges for S/I/A counts
- Summary column: `.status-bar` style

---

### 4.9 Error / Success Pages (`/error`, `/success`)

**Layout:** Standalone, no navbar, full viewport centered.

**Card:**
- `.card-brutalist`, max-width `28rem`
- Icon wrapper: 64×64px, `border-radius: 2px`, colored soft background, hard shadow
- Title: `font-weight: 900`, colored text (danger for error, success for success)
- Message: muted, centered
- Button: `.btn-brutalist` or `.btn-brutalist-outline`

---

### 4.10 TS Manager (`/admin/tsmanager`)

**Outer:**
- `.card-brutalist`
- Header: `.card-brutalist-header` with `.section-label` "TS_MANAGER" + back button

**Teacher Table:**
- `.table-brutalist`
- Columns: No, Nama, Email, Mapel, Actions
- Sticky first column
- Action buttons: `.btn-brutalist-outline` small size for edit/delete

**Modals:**
- Use `.modal-content-custom` but override `border-radius: 0`
- Header: `.card-brutalist-header` style
- Footer: `.card-brutalist-body` style with `.btn-brutalist` + `.btn-brutalist-outline`

---

## 5. Button Hierarchy

| Priority | Class | Use Case |
|----------|-------|----------|
| Primary | `.btn-brutalist` | Submit, Save, Confirm, Login |
| Secondary | `.btn-brutalist-outline` | Cancel, Back, Filter, Export |
| Danger | `.btn-brutalist` with danger variant | Delete, Remove, Hapus |
| Success | `.btn-brutalist` with success variant | Approve, Activate, Aktifkan |

**Button sizing:**
- Default: `padding: 0.875rem 1.5rem`
- Small: `padding: 0.5rem 1rem`, `font-size: 0.8125rem`
- Full width: `width: 100%`
- Icon buttons: square aspect, `padding: 0.75rem`

---

## 6. Form Input Styles (Brutalist)

All form inputs on brutalist pages must use this pattern:

```css
.brutalist-input {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-main);
  background-color: var(--bg-input);
  border: 2px solid var(--dark-400);
  border-radius: 0;
  transition: all 0.15s ease;
}

.brutalist-input:focus {
  border-color: var(--primary);
  box-shadow: 3px 3px 0px rgba(59, 130, 246, 0.3);
  outline: none;
}

.brutalist-input::placeholder {
  color: var(--dark-500);
  opacity: 1;
}

.brutalist-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: rgba(30, 41, 59, 0.5);
}
```

**Selects:** Same border treatment, custom arrow icon (monochrome, hard edges).

**Labels:** `.section-label` style — monospace, uppercase, `font-size: 0.65rem`, `letter-spacing: 0.12em`, accent background.

---

## 7. Table Styles (Brutalist)

New class needed: `.table-brutalist`

```css
.table-brutalist {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
}

.table-brutalist th,
.table-brutalist td {
  padding: 1rem;
  border: 1px solid var(--dark-400);
  text-align: left;
  vertical-align: middle;
}

.table-brutalist thead th {
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent-soft-text);
  background: var(--accent-soft);
  border-bottom: 2px solid var(--dark-400);
  white-space: nowrap;
}

.table-brutalist tbody tr {
  transition: background-color 0.15s ease;
}

.table-brutalist tbody tr:hover {
  background-color: rgba(248, 250, 252, 0.04);
}

.table-brutalist tbody tr:nth-child(even) {
  background-color: rgba(248, 250, 252, 0.015);
}

.table-brutalist tbody tr:nth-child(even):hover {
  background-color: rgba(248, 250, 252, 0.04);
}
```

**Sticky columns:** For wide tables (backup grid, rekap presensi), use `position: sticky` with `background: var(--bg-card)` and `z-index` layering.

---

## 8. Section Headers

Use `.section-label` for all section labels across all pages:

```html
<span className="section-label">SECTION_NAME</span>
<h2 className="h4 mb-3">Human Readable Title</h2>
```

**Rules:**
- Always uppercase
- Monospace font
- Accent background with subtle border
- Placed directly above the section title
- Spacing: `margin-bottom: 1rem`

---

## 9. Special Brutalist Elements

### 9.1 Status Bar
```html
<div className="status-bar">
  <span className="status-bar-dot"></span>
  <span>SYSTEM_ACTIVE</span>
</div>
```
- Monospace, uppercase, small
- Pulsing dot animation
- Used for system status, connection indicators

### 9.2 Hadith Card (Brutalist Variant)
```html
<div className="hadith-brutalist">
  <div className="hadith-brutalist-label">HADITS_HARI_INI</div>
  <div className="hadith-arabic">...</div>
  <div className="hadith-translation">...</div>
  <div className="hadith-source">...</div>
</div>
```
- Left accent border (4px solid accent)
- Dashed inner borders for Arabic text
- Monospace label and source

### 9.3 Divider
```html
<hr className="divider-brutalist" />
```
- Dashed line, repeating pattern
- Used between major sections

### 9.4 Empty State
```html
<div className="empty-state">
  <i className="fas fa-inbox"></i>
  <p>Tidak ada data untuk filter yang dipilih.</p>
</div>
```
- Centered, muted, large icon with low opacity

---

## 10. Color Usage by Page Type

| Page Type | Primary Accent | Secondary Accent | Danger | Success |
|-----------|---------------|------------------|--------|---------|
| Auth | Primary | — | Danger | — |
| Admin Dashboard | Primary | Success/Info/Warning | — | Success |
| Journal | Primary | Info | — | Success |
| Schedule | Primary | Info | — | — |
| Attendance | Warning | Primary | Danger | Success |
| Export/Backup | Primary | Info | Danger | Success |
| Profile | Primary | — | — | Success |
| Rekap Semester | Primary | Info | Warning | Success |
| Error | — | — | Danger | — |
| Success | — | — | — | Success |
| TS Manager | Primary | Info | Danger | — |

---

## 11. Responsive Behavior

- **Mobile (<768px):** Single column, full-width cards, mobile bottom nav visible
- **Tablet (768px-1024px):** 2-column grids where applicable, table horizontal scroll
- **Desktop (>1024px):** Multi-column layouts, max-width containers (`container` class)

**All cards must be full-width on mobile** with consistent padding (`1rem` on mobile, `1.5rem` on desktop).

---

## 12. Implementation Checklist

For each page migration to brutalist:

- [ ] Replace `.card` with `.card-brutalist` where appropriate
- [ ] Replace `.card-header` with `.card-brutalist-header`
- [ ] Replace `.card-body` with `.card-brutalist-body`
- [ ] Replace `.btn-primary` with `.btn-brutalist`
- [ ] Replace `.btn-outline-custom` with `.btn-brutalist-outline`
- [ ] Replace `.form-control` / `.form-select` with `.brutalist-input` / `.brutalist-select`
- [ ] Replace `.table` with `.table-brutalist`
- [ ] Add `.section-label` above section titles
- [ ] Ensure `border-radius: 0` on all interactive elements
- [ ] Verify hard shadows on all cards and buttons
- [ ] Test hover states (lift + shadow increase)
- [ ] Verify mobile bottom nav uses `.mobile-bottom-nav-brutalist` + `.mobile-nav-link-brutalist`

---

## 13. New CSS Classes Required

Add these to `src/app/globals.css` under the Brutalist section:

| Class | Purpose |
|-------|---------|
| `.brutalist-input` | Brutalist form input |
| `.brutalist-select` | Brutalist select dropdown |
| `.table-brutalist` | Brutalist data table |
| `.btn-brutalist-danger` | Danger variant of brutalist button |
| `.btn-brutalist-success` | Success variant of brutalist button |
| `.modal-brutalist` | Brutalist modal overlay |
| `.modal-content-brutalist` | Brutalist modal content |
| `.badge-brutalist` | Small monospace badge |
| `.grid-brutalist` | Editable grid cells for backup page |
| `.toast-brutalist` | Brutalist toast notification |

---

*Document generated for NgajarYuk Next.js — Brutalist Design System v1.0*
