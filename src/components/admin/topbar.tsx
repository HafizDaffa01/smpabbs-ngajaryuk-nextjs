'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, LogOut, Menu, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown'
import type { AdminUser } from './sidebar'

/** Human-readable labels for the admin route segments. */
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  teachers: 'Guru',
  'import-teachers': 'Import Guru',
  import: 'Import Siswa',
  tsmanager: 'TS Manager',
  absensi: 'Absensi',
}

type TopbarProps = {
  user: AdminUser
  onOpenDrawer: () => void
  drawerOpen: boolean
  /** Lets the shell restore focus to the hamburger after the drawer closes. */
  menuButtonRef?: React.Ref<HTMLButtonElement>
}

export function Topbar({
  user,
  onOpenDrawer,
  drawerOpen,
  menuButtonRef,
}: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = React.useState(false)

  // Skip the leading "admin" segment — it is rendered as the root crumb.
  const segments = (pathname ?? '').split('/').filter(Boolean).slice(1)

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
            <li className="hidden sm:block">
              <Link
                href="/admin"
                className="focus-ring rounded-sm transition-colors duration-150 ease-out hover:text-text-primary"
              >
                Admin
              </Link>
            </li>
            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1
              return (
                <li key={segment} className="flex min-w-0 items-center gap-1">
                  <ChevronRight
                    aria-hidden
                    className="size-3.5 shrink-0 text-text-disabled"
                  />
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={cn(
                      'truncate',
                      isLast ? 'font-semibold text-text-primary' : undefined
                    )}
                  >
                    {SEGMENT_LABELS[segment] ?? segment}
                  </span>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Keluar"
            title="Keluar dari akun"
            className={cn(
              'focus-ring inline-flex h-10 items-center gap-2 rounded-md border px-2.5 sm:px-3',
              'border-danger-border bg-danger-bg text-danger-text',
              'transition-[background-color,border-color,color] duration-150 ease-out',
              'hover:border-danger-text hover:bg-danger-text hover:text-white',
              'disabled:cursor-not-allowed disabled:opacity-60'
            )}
          >
            <LogOut aria-hidden className="size-4 shrink-0" />
            <span className="hidden text-sm font-semibold sm:inline">
              {loggingOut ? 'Memproses…' : 'Keluar'}
            </span>
          </button>

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
              <span className="hidden max-w-32 truncate text-sm font-medium text-text-primary sm:block">
                {user.name}
              </span>
            </DropdownTrigger>

            <DropdownContent>
              <DropdownLabel>{user.email ?? user.name}</DropdownLabel>
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
              <DropdownItem
                onClick={handleLogout}
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
