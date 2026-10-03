'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'

export type AdminUser = {
  name: string
  email?: string | null
}

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Ringkasan',
    items: [{ href: '/admin', label: 'Ringkasan', icon: LayoutDashboard }],
  },
  {
    label: 'Data Master',
    items: [
      { href: '/admin/teachers', label: 'Guru', icon: Users },
      { href: '/admin/import-teachers', label: 'Import Guru', icon: UserPlus },
      { href: '/admin/import', label: 'Import Siswa', icon: FileSpreadsheet },
      { href: '/admin/tsmanager', label: 'TS Manager', icon: BookOpenCheck },
    ],
  },
  {
    label: 'Absensi',
    items: [{ href: '/admin/absensi', label: 'Absensi', icon: CalendarCheck }],
  },
]

/** `/admin` itself is only active on an exact match; children match by prefix. */
function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

type SidebarProps = {
  user: AdminUser
  variant: 'desktop' | 'mobile'
  collapsed?: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
  /** Element the drawer should move focus into on open. */
  panelRef?: React.Ref<HTMLDivElement>
}

export function Sidebar({
  user,
  variant,
  collapsed = false,
  onToggleCollapse,
  onClose,
  panelRef,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = React.useState(false)
  const isCollapsed = variant === 'desktop' && collapsed

  async function handleLogout() {
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
  }

  return (
    <div
      ref={panelRef}
      className="flex h-full flex-col border-r border-border-subtle bg-surface-card"
    >
      {/* Brand block */}
      <div
        className={cn(
          'flex h-15 shrink-0 items-center gap-2.5 border-b border-border-subtle',
          isCollapsed ? 'justify-center px-2' : 'px-4'
        )}
      >
        <Link
          href="/admin"
          onClick={onClose}
          className="focus-ring flex min-w-0 items-center gap-2.5 rounded-md"
          aria-label="NgajarYuk — beranda admin"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent"
          >
            <BookOpen className="size-5" />
          </span>
          {!isCollapsed ? (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-base font-bold text-text-primary">
                NgajarYuk
              </span>
              <span className="truncate text-xs text-text-tertiary">
                SMP ABBS Surakarta
              </span>
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
        aria-label="Navigasi admin"
        className="flex-1 overflow-y-auto overscroll-contain px-2 py-3"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {isCollapsed ? (
              <div
                aria-hidden
                className="mx-auto mb-2 h-px w-6 bg-border-subtle"
              />
            ) : (
              <p className="eyebrow px-2 pb-1.5">{group.label}</p>
            )}

            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href)
                const Icon = item.icon

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        'focus-ring relative flex h-11 items-center gap-2.5 rounded-md text-sm font-medium lg:h-10',
                        'transition-[background-color,color] duration-150 ease-out',
                        isCollapsed ? 'justify-center px-0' : 'px-2.5',
                        active
                          ? 'bg-accent-subtle text-accent-subtle-text'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute top-1/2 -left-2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
                        />
                      ) : null}
                      <Icon aria-hidden className="size-[18px] shrink-0" />
                      {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
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
              <span className="truncate text-xs text-text-tertiary">
                Administrator
              </span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleLogout}
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
          {!isCollapsed ? (
            <span>{loggingOut ? 'Memproses…' : 'Keluar'}</span>
          ) : null}
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
