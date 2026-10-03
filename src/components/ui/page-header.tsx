import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Crumb = {
  label: string
  href?: string
}

type PageHeaderProps = {
  title: React.ReactNode
  description?: React.ReactNode
  crumbs?: Crumb[]
  /** Buttons / menus aligned right on desktop, full-width row on mobile. */
  actions?: React.ReactNode
  className?: string
}

/**
 * The single `<h1>` of a page, preceded by its breadcrumb trail. Rendered
 * inside the admin shell, so it only needs to handle its own row layout.
 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-[13px] text-text-tertiary">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? (
                    <ChevronRight aria-hidden className="size-3.5 shrink-0 text-text-disabled" />
                  ) : null}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="rounded-sm transition-colors duration-150 ease-out hover:text-accent-text"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-text-secondary">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
          {title}
        </h1>

        {description ? (
          <p className="prose-block max-w-2xl text-text-secondary">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="action-row flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
