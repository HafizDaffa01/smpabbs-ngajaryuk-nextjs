import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        success: 'border-success-border bg-success-bg text-success-text',
        info: 'border-info-border bg-info-bg text-info-text',
        warning: 'border-warning-border bg-warning-bg text-warning-text',
        danger: 'border-danger-border bg-danger-bg text-danger-text',
        neutral: 'border-neutral-border bg-neutral-bg text-neutral-text',
        accent: 'border-accent-border bg-accent-subtle text-accent-subtle-text',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
