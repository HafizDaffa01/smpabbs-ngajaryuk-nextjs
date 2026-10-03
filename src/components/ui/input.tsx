'use client'

import * as React from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const controlBase = [
  'focus-ring block w-full rounded-sm border bg-surface-card text-sm text-text-primary',
  'placeholder:text-text-disabled',
  'transition-[border-color,box-shadow] duration-150 ease-out',
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled',
].join(' ')

export function Input({
  className,
  invalid,
  ...props
}: React.ComponentProps<'input'> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        'h-9 border-border-default px-3',
        invalid ? 'border-danger-text' : 'hover:border-border-strong',
        className
      )}
      {...props}
    />
  )
}

export function Textarea({
  className,
  invalid,
  ...props
}: React.ComponentProps<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        'min-h-20 resize-y border-border-default px-3 py-2 leading-relaxed',
        invalid ? 'border-danger-text' : 'hover:border-border-strong',
        className
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: React.ComponentProps<'select'> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          controlBase,
          'h-9 appearance-none border-border-default py-0 pr-8 pl-3',
          invalid ? 'border-danger-text' : 'hover:border-border-strong',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-tertiary"
      />
    </div>
  )
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn(
        'flex items-center gap-1 text-[13px] font-medium text-text-secondary',
        className
      )}
      {...props}
    />
  )
}

type FieldProps = {
  /** Wired to the control's `id` via <label htmlFor>. */
  id: string
  label: string
  /** Shown under the control; hidden from screen readers when an error exists. */
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': true | undefined
    'aria-required': true | undefined
  }) => React.ReactNode
}

/**
 * Label + control + helper text + error, wired with aria-describedby /
 * aria-invalid. Labels are always visible — placeholder-only fields are an
 * accessibility anti-pattern, especially in a data-dense admin.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden className="text-danger-text">
            *
          </span>
        ) : null}
      </Label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1 text-[13px] font-medium text-danger-text"
        >
          <AlertCircle aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-text-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
