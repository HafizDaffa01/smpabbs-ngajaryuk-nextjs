'use client'

import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Reserved for a named icon; falls back to Inbox. */
  icon?: 'inbox' | string
  title: string
  description?: string
  className?: string
  action?: React.ReactNode
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  className,
  action,
}: EmptyStateProps) {
  const Icon = icon === 'inbox' ? Inbox : Inbox

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-10 text-center',
        className
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-md border border-dashed border-border-default bg-surface-sunken text-text-tertiary">
        <Icon aria-hidden className="size-6" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-text-primary">{title}</h3>
      {description ? (
        <p className="mb-4 max-w-sm text-sm text-text-tertiary">{description}</p>
      ) : null}
      {action}
    </div>
  )
}
