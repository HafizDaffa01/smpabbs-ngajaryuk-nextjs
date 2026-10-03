'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Button } from './button'

const dialogSizes = cva(
  'w-[calc(100vw-2rem)] rounded-lg border border-border-subtle bg-surface-raised p-0 shadow-lg',
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

type DialogProps = Omit<React.ComponentProps<'dialog'>, 'title'> &
  VariantProps<typeof dialogSizes> & {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    children: React.ReactNode
    footer?: React.ReactNode
    /** Hide the built-in close affordance for blocking dialogs. */
    hideClose?: boolean
  }

/**
 * Modal built on the native `<dialog>` element, so focus trapping, inertness
 * of the page behind it and Escape-to-close come from the platform.
 */
export function Dialog({
  open,
  onOpenChange,
  size,
  title,
  description,
  children,
  footer,
  hideClose,
  className,
  ...props
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null)
  const titleId = React.useId()
  const descriptionId = React.useId()

  React.useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      className={cn(
        dialogSizes({ size }),
        'm-auto backdrop:bg-black/45 backdrop:backdrop-blur-[2px]',
        'open:flex open:max-h-[calc(100dvh-2rem)] open:flex-col',
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-semibold text-text-primary">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="text-[13px] text-text-tertiary">
              {description}
            </p>
          ) : null}
        </div>
        {hideClose ? null : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Tutup dialog"
          >
            <X aria-hidden className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle bg-surface-sunken px-4 py-3 sm:px-5">
          {footer}
        </div>
      ) : null}
    </dialog>
  )
}
