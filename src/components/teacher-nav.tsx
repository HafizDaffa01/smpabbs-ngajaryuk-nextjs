'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  CalendarDays,
  FileDown,
  FolderOpen,
  Home,
  MapPin,
  NotebookPen,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type TeacherNavItem = {
  href: string
  label: string
  icon: LucideIcon
  /**
   * Privileged destination (the admin panel). Rendered in the `warning` ramp
   * instead of the brand ramp so leaving the teacher context is visible.
   */
  privileged?: boolean
}

export type TeacherNavGroup = {
  label: string
  items: TeacherNavItem[]
}

/**
 * Teacher navigation. Deliberately not the admin list: the teacher job is
 * "teach today", so the daily routes come first and reporting is a separate
 * concern. `/jadwal` is not a route — the schedule page lives at `/schedule`.
 */
export const TEACHER_NAV_GROUPS: TeacherNavGroup[] = [
  {
    label: 'Utama',
    items: [
      { href: '/', label: 'Beranda', icon: Home },
      { href: '/absensi', label: 'Absensi', icon: MapPin },
      { href: '/journal', label: 'Jurnal', icon: NotebookPen },
      { href: '/schedule', label: 'Jadwal', icon: CalendarDays },
    ],
  },
  {
    label: 'Laporan',
    items: [
      { href: '/prevSmes', label: 'Prev Semester', icon: BarChart3 },
      { href: '/export', label: 'Export Data', icon: FileDown },
    ],
  },
  {
    label: 'Lainnya',
    items: [
      { href: '/explorer', label: 'Explorer', icon: FolderOpen },
      { href: '/profile', label: 'Profil', icon: User },
    ],
  },
]

/** Only rendered when `user.isAdmin` — see `AppShell`. */
export const ADMIN_NAV_ITEM: TeacherNavItem = {
  href: '/admin',
  label: 'Panel Admin',
  icon: ShieldCheck,
  privileged: true,
}

/**
 * Human-readable labels for the teacher route segments, shared with the
 * topbar breadcrumb so a segment never shows up as a raw slug.
 */
export const SEGMENT_LABELS: Record<string, string> = {
  absensi: 'Absensi',
  journal: 'Jurnal',
  schedule: 'Jadwal',
  prevSmes: 'Prev Semester',
  presensi: 'Presensi',
  show: 'Detail',
  export: 'Export Data',
  explorer: 'Explorer',
  profile: 'Profil',
  admin: 'Admin',
}

/** `/` is only active on an exact match; every other href matches by prefix. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

type TeacherNavProps = {
  /** Rail mode: icons only, with the label moved to a tooltip. */
  collapsed?: boolean
  isAdmin?: boolean
  /** Called on every link activation so the mobile drawer can close. */
  onNavigate?: () => void
}

/**
 * The link list shared by the desktop rail and the mobile drawer. Group labels
 * collapse to a hairline rule when the rail is narrow, matching the admin
 * sidebar's rhythm.
 */
export function TeacherNav({ collapsed = false, isAdmin = false, onNavigate }: TeacherNavProps) {
  const pathname = usePathname()
  const items = React.useMemo(
    () => (isAdmin ? [...TEACHER_NAV_GROUPS, { label: '', items: [ADMIN_NAV_ITEM] }] : TEACHER_NAV_GROUPS),
    [isAdmin]
  )

  return (
    <>
      {items.map((group) => (
        <div key={group.label || 'privileged'} className="mb-4 last:mb-0">
          {group.label ? (
            collapsed ? (
              <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-border-subtle" />
            ) : (
              <p className="eyebrow px-2 pb-1.5">{group.label}</p>
            )
          ) : (
            <div
              aria-hidden
              className={cn('mb-2 h-px bg-border-subtle', collapsed ? 'mx-auto w-6' : 'mx-2 w-auto')}
            />
          )}

          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isNavActive(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: TeacherNavItem
  active: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'focus-ring relative flex h-11 items-center gap-2.5 rounded-md text-sm font-medium lg:h-10',
        'transition-[background-color,color,border-color] duration-150 ease-out',
        collapsed ? 'justify-center px-0' : 'px-2.5',
        item.privileged
          ? cn(
              'border',
              active
                ? 'border-warning-border bg-warning-border text-warning-text'
                : 'border-warning-border bg-warning-bg text-warning-text hover:border-warning-text'
            )
          : active
            ? 'bg-accent-subtle text-accent-subtle-text'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
      )}
    >
      {active ? (
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 -left-2 h-6 w-[3px] -translate-y-1/2 rounded-r-full',
            item.privileged ? 'bg-warning-text' : 'bg-accent'
          )}
        />
      ) : null}
      <Icon aria-hidden className="size-[18px] shrink-0" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  )
}