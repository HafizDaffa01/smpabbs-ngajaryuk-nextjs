import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Deterministic tone set, so the same person always gets the same colour.
 * Every entry is token-driven — no raw hex anywhere.
 */
const TONES = [
  'bg-accent-subtle text-accent-subtle-text',
  'bg-info-bg text-info-text',
  'bg-success-bg text-success-text',
  'bg-warning-bg text-warning-text',
  'bg-danger-bg text-danger-text',
  'bg-neutral-bg text-neutral-text',
] as const

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 2147483647
  }
  return Math.abs(hash)
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const avatarVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
  {
    variants: {
      size: {
        sm: 'size-8 text-xs',
        md: 'size-10 text-[13px]',
        lg: 'size-12 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export function Avatar({
  name,
  size,
  className,
  title,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof avatarVariants> & { name: string; title?: string }) {
  const safeName = name?.trim() || 'Pengguna'
  return (
    <span
      title={title ?? safeName}
      aria-hidden
      className={cn(
        avatarVariants({ size }),
        TONES[hashName(safeName) % TONES.length],
        className
      )}
      {...props}
    >
      {getInitials(safeName)}
    </span>
  )
}
