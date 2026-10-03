import * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-md border border-border-subtle bg-surface-card shadow-sm',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5 sm:py-4',
        className
      )}
      {...props}
    />
  )
}

type CardTitleProps = React.ComponentProps<'h2'> & {
  /**
   * Heading level, so a page can keep a sane outline (h1 → h2 → h3) instead of
   * jumping straight from the page title to an h3.
   */
  as?: 'h2' | 'h3'
}

export function CardTitle({ className, as: Tag = 'h2', ...props }: CardTitleProps) {
  return (
    <Tag
      className={cn('text-base font-semibold text-text-primary', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p className={cn('mt-0.5 text-[13px] text-text-tertiary', className)} {...props} />
  )
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-4 py-4 sm:px-5', className)} {...props} />
}

export function CardFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle bg-surface-sunken px-4 py-3 sm:px-5',
        className
      )}
      {...props}
    />
  )
}
