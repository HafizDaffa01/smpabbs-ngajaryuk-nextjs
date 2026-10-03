import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Visually hidden caption. Every data table needs one — either a real visible
 * caption or this one — so the table has an accessible name.
 */
function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption className={cn('sr-only', className)} {...props} />
}

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <table
      className={cn(
        'w-full border-collapse text-sm tabular-nums',
        'border-spacing-0',
        className
      )}
      {...props}
    />
  )
}

/** Sticky header row. Pair with `<TableBody maxHeight>` so it has a scroller. */
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('bg-surface-sunken', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={className} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-border-subtle transition-colors duration-150 ease-out',
        'last:border-b-0 hover:bg-surface-hover',
        'focus-within:bg-surface-hover',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'eyebrow sticky top-0 z-10 bg-surface-sunken',
        'border-b border-border-default px-3 py-2.5 text-left',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      className={cn('px-3 py-2.5 align-middle text-text-secondary', className)}
      {...props}
    />
  )
}

/**
 * Scroll container for the table. `maxHeight` turns it into a vertical
 * scroller so the sticky `TableHead` has something to stick to.
 */
function TableScroll({
  className,
  maxHeight,
  label = 'Tabel data',
  ...props
}: React.ComponentProps<'div'> & { maxHeight?: string; label?: string }) {
  if (!maxHeight) {
    return (
      <div className={cn('w-full overflow-x-auto', className)} {...props} />
    )
  }
  return (
    <div
      className={cn('w-full overflow-auto', className)}
      style={{ maxHeight }}
      tabIndex={0}
      role="group"
      aria-label={label}
      {...props}
    />
  )
}

export {
  Table,
  TableCaption,
  TableScroll,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
}
