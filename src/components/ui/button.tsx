import * as React from 'react'
import Link from 'next/link'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Button primitive.
 *
 * Sizes: `sm` 32px · `md` 36px · `lg` 44px (mobile touch target).
 * Icon-only buttons use `icon` (40px) or `icon-lg` (44px) and MUST carry an
 * `aria-label`, since they have no visible text.
 */
export const buttonVariants = cva(
  [
    'focus-ring inline-flex shrink-0 items-center justify-center gap-2',
    'rounded-sm border font-semibold whitespace-nowrap select-none',
    'transition-[background-color,border-color,color,box-shadow] duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-55',
  ],
  {
    variants: {
      variant: {
        primary:
          'border-accent bg-accent text-on-accent hover:border-accent-hover hover:bg-accent-hover active:border-accent-active active:bg-accent-active',
        secondary:
          'border-border-default bg-surface-card text-text-primary hover:border-border-strong hover:bg-surface-hover',
        ghost:
          'border-transparent bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        subtle:
          'border-transparent bg-surface-sunken text-text-primary hover:bg-surface-hover',
        danger:
          'border-danger-text bg-danger-text text-white hover:brightness-95 active:brightness-90',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-11 px-4 text-sm',
        icon: 'h-10 w-10 p-0',
        'icon-lg': 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

type ButtonBaseProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
    /** Render the spinner before the label and keep the label width stable. */
    loadingText?: string
  }

export function Button({
  className,
  variant,
  size,
  loading = false,
  loadingText,
  disabled,
  children,
  type,
  ...props
}: ButtonBaseProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 aria-hidden className="size-4 animate-spin" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

type ButtonLinkProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
  }

/** Anchor styled as a button — `asChild` equivalent without a slot library. */
export function ButtonLink({
  className,
  variant,
  size,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  )
}
