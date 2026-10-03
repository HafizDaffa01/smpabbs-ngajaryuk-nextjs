'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type DropdownContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerId: string
  menuId: string
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null)

function useDropdown(component: string): DropdownContextValue {
  const context = React.useContext(DropdownContext)
  if (!context) throw new Error(`${component} must be used inside <Dropdown>`)
  return context
}

type DropdownProps = {
  children: React.ReactNode
  className?: string
  /** Menu opens below (default) or above the trigger. */
  align?: 'start' | 'end'
}

/**
 * Popover-free dropdown. Handles click-outside, Escape (returns focus to the
 * trigger) and roving arrow-key focus across menu items.
 */
export function Dropdown({ children, className, align = 'end' }: DropdownProps) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        rootRef.current
          ?.querySelector<HTMLElement>('[data-dropdown-trigger]')
          ?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const value = React.useMemo<DropdownContextValue>(
    () => ({
      open,
      setOpen,
      triggerId: `${id}-trigger`,
      menuId: `${id}-menu`,
    }),
    [open, id]
  )

  return (
    <DropdownContext.Provider value={value}>
      <div
        ref={rootRef}
        className={cn('relative', align === 'end' && 'flex justify-end', className)}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

type DropdownTriggerProps = React.ComponentProps<'button'> & {
  children: React.ReactNode
}

export function DropdownTrigger({
  children,
  className,
  onClick,
  onKeyDown,
  ...props
}: DropdownTriggerProps) {
  const { open, setOpen, triggerId, menuId } = useDropdown('DropdownTrigger')

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <button
      type="button"
      id={triggerId}
      data-dropdown-trigger=""
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={(event) => {
        onClick?.(event)
        setOpen(!open)
      }}
      onKeyDown={handleKeyDown}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}

type DropdownContentProps = React.ComponentProps<'div'> & {
  children: React.ReactNode
  labelledBy?: string
}

export function DropdownContent({
  children,
  className,
  labelledBy,
  ...props
}: DropdownContentProps) {
  const { open, menuId, triggerId, setOpen } = useDropdown('DropdownContent')
  const ref = React.useRef<HTMLDivElement>(null)

  // Move focus into the menu once it opens so keyboard users land inside.
  React.useEffect(() => {
    if (!open) return
    const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]')
    first?.focus()
  }, [open])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    )
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLElement)

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        items[(current + 1 + items.length) % items.length]?.focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        items[(current - 1 + items.length) % items.length]?.focus()
        break
      case 'Home':
        event.preventDefault()
        items[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        items[items.length - 1]?.focus()
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  if (!open) return null

  return (
    <div
      ref={ref}
      id={menuId}
      role="menu"
      aria-labelledby={labelledBy ?? triggerId}
      onKeyDown={handleKeyDown}
      className={cn(
        'absolute top-[calc(100%+4px)] right-0 z-50 min-w-48 rounded-md border border-border-default',
        'bg-surface-raised p-1 shadow-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

type DropdownItemProps = React.ComponentProps<'button'> & {
  children: React.ReactNode
  /** Right-aligned helper text, e.g. a keyboard shortcut. */
  hint?: string
}

export function DropdownItem({
  children,
  className,
  hint,
  onClick,
  onKeyDown,
  ...props
}: DropdownItemProps) {
  const { setOpen } = useDropdown('DropdownItem')

  return (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => {
        onClick?.(event)
        setOpen(false)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          ;(event.currentTarget as HTMLButtonElement).click()
        }
      }}
      className={cn(
        'focus-ring flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm',
        'text-text-secondary transition-colors duration-150 ease-out',
        'hover:bg-surface-hover hover:text-text-primary',
        className
      )}
      {...props}
    >
      {children}
      {hint ? <span className="meta ml-auto">{hint}</span> : null}
    </button>
  )
}

export function DropdownLabel({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('eyebrow px-2.5 pt-2 pb-1', className)} {...props} />
}

export function DropdownSeparator() {
  return <div role="separator" className="my-1 h-px bg-border-subtle" />
}
