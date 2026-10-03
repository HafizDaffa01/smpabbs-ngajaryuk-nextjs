'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sidebar, type AdminUser } from './sidebar'
import { Topbar } from './topbar'

const COLLAPSE_STORAGE_KEY = 'admin-sidebar-collapsed'
const COLLAPSE_EVENT = 'ngajaryuk:sidebar-collapsed'

/* ------------------------------------------------------------------ *
 * Collapsed-rail store.
 * `localStorage` is the source of truth, surfaced through
 * `useSyncExternalStore` so the first client render matches the server HTML
 * (no hydration mismatch) while still restoring the saved rail width.
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type AdminShellProps = {
  user: AdminUser
  children: React.ReactNode
}

/**
 * Owns the two pieces of shell state the sidebar and topbar share: the
 * collapsed desktop rail and the mobile off-canvas drawer.
 */
export function AdminShell({ user, children }: AdminShellProps) {
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

  const openDrawer = React.useCallback(
    () => setDrawer({ at: pathname }),
    [pathname]
  )

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
      {/* Desktop: fixed rail, 264px expanded / 72px collapsed */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] lg:block"
        aria-label="Sidebar admin"
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

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
