'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown'
import { ADMIN_NAV_ITEM, SEGMENT_LABELS, TeacherNav } from '@/components/teacher-nav'

export type ShellUser = {
  name: string
  email?: string | null
  isAdmin?: boolean
}

export type AppShellProps = {
  user: ShellUser
  children: React.ReactNode
}

const COLLAPSE_STORAGE_KEY = 'teacher-sidebar-collapsed'
const COLLAPSE_EVENT = 'ngajaryuk:teacher-sidebar-collapsed'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/* ------------------------------------------------------------------ *
 * Collapsed-rail store. Kept separate from the admin shell's store (a
 * different localStorage key + event name) so the two shells remember
 * their own rail state independently.
 * ------------------------------------------------------------------ */

function subscribeCollapsed(onStoreChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onStoreChange)
  return () => window.removeEventListener(COLLAPSE_EVENT, onStoreChange)
}

function getCollapsedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function getCollapsedServerSnapshot(): boolean {
  return false
}

function setCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    /* storage blocked — the rail still collapses for this session */
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT))
}

/** Shared by the sidebar footer and the topbar account menu. */
function useLogout() {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = React.useState(false)

  const logout = React.useCallback(async () => {
    setLoggingOut(true)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (response.ok) {
        router.push('/login')
        router.refresh()
      }
    } catch {
      console.error('Logout failed')
    } finally {
      setLoggingOut(false)
    }
  }, [router])

  return { loggingOut, logout }
}

/**
 * Teacher-facing application shell: collapsible rail on desktop, off-canvas
 * drawer on mobile, sticky topbar.
 *
 * It is the same system as `src/components/admin/shell.tsx` — same tokens,
 * radius, elevation and icon language — but a different *context*: a school
 * teacher's daily workspace, marked by the graduation-cap brand lockup, the
 * "Portal Guru" role label, and the amber `Panel Admin` escape hatch.
 *
 * `data-ds-shell` is applied to the root purely to pick up the five utility
 * classes that `globals.css` scopes to it (`focus-ring`, `eyebrow`, `meta`,
 * `prose-block`, `action-row`) plus the reduced-motion and scrollbar rules —
 * they are inherited, not redefined. Once those rules are promoted to a
 * neutral scope by whoever owns `globals.css`, this attribute can be dropped.
 */
export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname()

  const collapsed = React.useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  )
  const [drawer, setDrawer] = React.useState<{ at: string } | null>(null)

  // Deriving openness from the route means a navigation closes the drawer
  // without an extra render pass or a state-synchronising effect.
  const drawerOpen = drawer !== null && drawer.at === pathname

  const menuButtonRef = React.useRef<HTMLButtonElement>(null)
  const drawerPanelRef = React.useRef<HTMLDivElement>(null)
  const wasDrawerOpen = React.useRef(false)

  const toggleCollapsed = React.useCallback(
    () => setCollapsed(!getCollapsedSnapshot()),
    []
  )

  const openDrawer = React.useCallback(() => setDrawer({ at: pathname }), [pathname])

  const closeDrawer = React.useCallback(() => setDrawer(null), [])

  // Escape closes the drawer; Tab is kept inside the panel while it is open.
  React.useEffect(() => {
    if (!drawerOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDrawer()
        return
      }
      if (event.key !== 'Tab') return

      const panel = drawerPanelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [drawerOpen, closeDrawer])

  // Move focus into the panel on open, and back to the trigger on close.
  React.useEffect(() => {
    if (drawerOpen) {
      const first = drawerPanelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    } else if (wasDrawerOpen.current) {
      menuButtonRef.current?.focus()
    }
    wasDrawerOpen.current = drawerOpen
  }, [drawerOpen])

  return (
    <div
      className="flex min-h-dvh"
      data-ds-shell
      style={{ '--sidebar-w': collapsed ? '72px' : '264px' } as React.CSSProperties}
    >
      <a
        href="#konten-utama"
        className={cn(
          'focus-ring sr-only rounded-md bg-accent text-sm font-semibold text-on-accent',
          'focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-60',
          'focus:inline-flex focus:h-10 focus:items-center focus:px-4 focus:shadow-md'
        )}
      >
        Lewati ke konten utama
      </a>

      {/* Desktop: fixed rail, 264px expanded / 72px collapsed */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] lg:block"
        aria-label="Sidebar guru"
      >
        <Sidebar
          user={user}
          variant="desktop"
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      {/* Mobile: off-canvas drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
      >
        <div
          onClick={closeDrawer}
          className={cn(
            'absolute inset-0 bg-black/45 transition-opacity duration-[250ms] ease-[var(--ds-ease)]',
            drawerOpen ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          ref={drawerPanelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
          className={cn(
            'absolute inset-y-0 left-0 w-72 max-w-[85vw]',
            'transition-transform duration-[250ms] ease-[var(--ds-ease)]',
            drawerOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full'
          )}
        >
          <Sidebar user={user} variant="mobile" onClose={closeDrawer} />
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[var(--sidebar-w)]">
        <Topbar
          user={user}
          drawerOpen={drawerOpen}
          onOpenDrawer={openDrawer}
          menuButtonRef={menuButtonRef}
        />

        <main id="konten-utama" tabIndex={-1} className="flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-6">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Sidebar
 * ------------------------------------------------------------------ */

function Sidebar({
  user,
  variant,
  collapsed = false,
  onToggleCollapse,
  onClose,
}: {
  user: ShellUser
  variant: 'desktop' | 'mobile'
  collapsed?: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
}) {
  const { loggingOut, logout } = useLogout()
  const isCollapsed = variant === 'desktop' && collapsed

  return (
    <div className="relative flex h-full flex-col border-r border-border-subtle bg-surface-card">
      {/* Brand block */}
      <div
        className={cn(
          'flex h-15 shrink-0 items-center gap-2.5 border-b border-border-subtle',
          isCollapsed ? 'justify-center px-2' : 'px-4'
        )}
      >
        <Link
          href="/"
          onClick={onClose}
          className="focus-ring flex min-w-0 items-center gap-2.5 rounded-md"
          aria-label="NgajarYuk — beranda guru"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent"
          >
            <GraduationCap className="size-5" />
          </span>
          {!isCollapsed ? (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-base font-bold text-text-primary">NgajarYuk</span>
              <span className="truncate text-xs text-text-tertiary">Portal Guru</span>
            </span>
          ) : null}
        </Link>

        {variant === 'mobile' && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu navigasi"
            className="focus-ring ml-auto inline-flex size-10 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 ease-out hover:bg-surface-hover hover:text-text-primary"
          >
            <X aria-hidden className="size-5" />
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Navigasi guru"
        className="flex-1 overflow-y-auto overscroll-contain px-2 py-3"
      >
        <TeacherNav collapsed={isCollapsed} isAdmin={user.isAdmin} onNavigate={onClose} />
      </nav>

      {/* Footer: user block + logout */}
      <div className="shrink-0 border-t border-border-subtle p-2">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-md p-1.5',
            isCollapsed && 'justify-center p-1'
          )}
        >
          <Avatar name={user.name} size="md" />
          {!isCollapsed ? (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold text-text-primary">
                {user.name}
              </span>
              <span className="truncate text-xs text-text-tertiary">Guru</span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          title={isCollapsed ? 'Keluar' : undefined}
          className={cn(
            'focus-ring mt-1 flex h-11 w-full items-center gap-2.5 rounded-md lg:h-10',
            'text-sm font-medium text-text-secondary',
            'transition-[background-color,color] duration-150 ease-out',
            'hover:bg-surface-hover hover:text-danger-text',
            'disabled:pointer-events-none disabled:opacity-55',
            isCollapsed ? 'justify-center' : 'px-2.5'
          )}
        >
          <LogOut aria-hidden className="size-[18px] shrink-0" />
          {!isCollapsed ? <span>{loggingOut ? 'Memproses…' : 'Keluar'}</span> : null}
          <span className="sr-only">{loggingOut ? 'Memproses' : 'Keluar'}</span>
        </button>
      </div>

      {/* Collapse control, pinned to the sidebar edge */}
      {variant === 'desktop' && onToggleCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Perlebar sidebar' : 'Perkecil sidebar'}
          aria-pressed={isCollapsed}
          className={cn(
            'focus-ring absolute top-11 -right-5 z-10 inline-flex size-10 items-center justify-center',
            'rounded-full border border-border-default bg-surface-card text-text-tertiary shadow-sm',
            'transition-[color,border-color] duration-150 ease-out',
            'hover:border-border-strong hover:text-text-primary'
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen aria-hidden className="size-3.5" />
          ) : (
            <PanelLeftClose aria-hidden className="size-3.5" />
          )}
        </button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Topbar
 * ------------------------------------------------------------------ */

function Topbar({
  user,
  onOpenDrawer,
  drawerOpen,
  menuButtonRef,
}: {
  user: ShellUser
  onOpenDrawer: () => void
  drawerOpen: boolean
  menuButtonRef?: React.Ref<HTMLButtonElement>
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { loggingOut, logout } = useLogout()

  // Drop the empty root segment; `/` renders as a single crumb.
  const segments = (pathname ?? '').split('/').filter(Boolean)
  const isHome = segments.length === 0

  return (
    <header className="sticky top-0 z-30 flex h-15 shrink-0 items-center border-b border-border-subtle bg-surface-card/95 backdrop-blur">
      <div className="flex h-full w-full items-center gap-2 px-4 sm:px-6 lg:px-8">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenDrawer}
          aria-label="Buka menu navigasi"
          aria-expanded={drawerOpen}
          className={cn(
            'focus-ring inline-flex size-10 items-center justify-center rounded-md lg:hidden',
            'border border-border-default bg-surface-card text-text-secondary',
            'transition-[background-color,border-color,color] duration-150 ease-out',
            'hover:border-border-strong hover:bg-surface-hover hover:text-text-primary'
          )}
        >
          <Menu aria-hidden className="size-5" />
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1 text-[13px] text-text-tertiary">
            {isHome ? (
              <li>
                <span aria-current="page" className="font-semibold text-text-primary">
                  Beranda
                </span>
              </li>
            ) : (
              <>
                <li className="hidden sm:block">
                  <Link
                    href="/"
                    className="focus-ring rounded-sm transition-colors duration-150 ease-out hover:text-text-primary"
                  >
                    Beranda
                  </Link>
                </li>
                {segments.map((segment, index) => {
                  const isLast = index === segments.length - 1
                  return (
                    <li key={segment} className="flex min-w-0 items-center gap-1">
                      <ChevronRight aria-hidden className="size-3.5 shrink-0 text-text-disabled" />
                      <span
                        aria-current={isLast ? 'page' : undefined}
                        className={cn('truncate', isLast ? 'font-semibold text-text-primary' : undefined)}
                      >
                        {SEGMENT_LABELS[segment] ?? segment}
                      </span>
                    </li>
                  )
                })}
              </>
            )}
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          <Dropdown align="end">
            <DropdownTrigger
              aria-label="Menu akun"
              className={cn(
                'focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-transparent',
                'pl-1 pr-2 transition-[background-color,border-color] duration-150 ease-out',
                'hover:border-border-default hover:bg-surface-hover'
              )}
            >
              <Avatar name={user.name} size="sm" />
              <span className="hidden max-w-28 truncate text-sm font-medium text-text-primary sm:block">
                {user.name}
              </span>
            </DropdownTrigger>

            <DropdownContent>
              {/*
                A plain block, not `DropdownLabel`: that primitive is styled
                `eyebrow` (uppercase, 12px), which would shout the teacher's
                own name. `DropdownContent` falls back to labelling the menu
                with the trigger's `aria-label`, so nothing is lost.
              */}
              <div className="flex min-w-0 flex-col gap-1 px-2.5 pt-2 pb-1.5">
                <span className="truncate text-sm font-semibold text-text-primary">
                  {user.name}
                </span>
                <span className="truncate text-xs text-text-tertiary">
                  {user.email ?? 'Akun guru'}
                </span>
                <Badge variant="accent" className="mt-0.5 w-fit">
                  Guru
                </Badge>
              </div>
              <DropdownSeparator />
              <DropdownItem
                onClick={() => {
                  router.push('/profile')
                  router.refresh()
                }}
              >
                <User aria-hidden className="size-4 shrink-0" />
                Edit Profil
              </DropdownItem>
              {user.isAdmin ? (
                <DropdownItem
                  onClick={() => {
                    router.push(ADMIN_NAV_ITEM.href)
                    router.refresh()
                  }}
                >
                  <ShieldCheck aria-hidden className="size-4 shrink-0" />
                  {ADMIN_NAV_ITEM.label}
                </DropdownItem>
              ) : null}
              <DropdownItem
                onClick={logout}
                disabled={loggingOut}
                className="text-danger-text hover:text-danger-text"
              >
                <LogOut aria-hidden className="size-4 shrink-0" />
                {loggingOut ? 'Memproses…' : 'Keluar'}
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>
    </header>
  )
}