'use client'

import * as React from 'react'
import { FileSpreadsheet, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from './input'

type DropzoneProps = {
  /** Wired to the real `<input type="file">`, which the parent form reads. */
  id: string
  name: string
  accept?: string
  required?: boolean
  disabled?: boolean
  /** Currently chosen file, or `null` for the idle state. */
  file: File | null
  onFileChange: (file: File | null) => void
  /** Lets the parent reset the underlying input after a successful import. */
  inputRef?: React.RefObject<HTMLInputElement | null>
  hint?: string
  className?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Two-state file picker.
 *
 * Idle: a dashed `--border-strong` target that accepts both a drop and a click,
 * 44px+ tall so it stays a comfortable touch target on phones. Active: the
 * chosen file with its size and a remove action.
 *
 * The real input stays in the DOM (visually hidden, never `display:none`, so
 * its value participates in `FormData`) and lives inside the surrounding
 * `<form>` — `formData.get(name)` keeps working untouched.
 */
export function Dropzone({
  id,
  name,
  accept,
  required,
  disabled,
  file,
  onFileChange,
  inputRef,
  hint,
  className,
}: DropzoneProps) {
  const localRef = React.useRef<HTMLInputElement>(null)
  const input = inputRef ?? localRef
  const [dragging, setDragging] = React.useState(false)

  function pickFile(candidate: File | undefined | null) {
    if (!candidate) return
    onFileChange(candidate)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    pickFile(event.dataTransfer.files?.[0])
  }

  const hintId = `${id}-hint`

  // Clearing the native input whenever the selection is empty keeps
  // `formData.get(name)` honest after a reset or a remove action.
  React.useEffect(() => {
    if (!file && input.current) input.current.value = ''
  }, [file, input])

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        File Excel
        {required ? (
          <span aria-hidden className="text-danger-text">
            *
          </span>
        ) : null}
      </Label>

      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        disabled={disabled}
        onChange={(event) => pickFile(event.target.files?.[0])}
        aria-describedby={hint ? hintId : undefined}
        className="sr-only"
      />

      {file ? (
        <div className="flex min-h-11 items-center gap-3 rounded-md border border-accent-border bg-accent-subtle px-3 py-2.5">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-card text-accent-text"
          >
            <FileSpreadsheet className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary" title={file.name}>
              {file.name}
            </p>
            <p className="meta">
              {formatSize(file.size)} · {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onFileChange(null)}
            aria-label={`Hapus file ${file.name}`}
            className={cn(
              'focus-ring inline-flex size-10 shrink-0 items-center justify-center rounded-md',
              'border border-transparent text-text-secondary transition-colors duration-150 ease-out',
              'hover:border-border-default hover:bg-surface-card hover:text-danger-text'
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          aria-describedby={hint ? hintId : undefined}
          onClick={() => !disabled && input.current?.click()}
          onKeyDown={(event) => {
            if (disabled) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              input.current?.click()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'focus-ring flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2',
            'rounded-md border-2 border-dashed px-4 py-8 text-center',
            'transition-[background-color,border-color] duration-150 ease-out',
            disabled
              ? 'cursor-not-allowed border-border-subtle bg-surface-sunken opacity-60'
              : dragging
                ? 'border-accent bg-accent-subtle'
                : 'border-border-strong bg-surface-card hover:border-accent hover:bg-accent-subtle'
          )}
        >
          <span
            aria-hidden
            className={cn(
              'flex size-11 items-center justify-center rounded-md',
              dragging
                ? 'bg-accent text-on-accent'
                : 'bg-surface-sunken text-accent-text'
            )}
          >
            <UploadCloud className="size-6" />
          </span>
          <span className="text-sm font-semibold text-text-primary">
            {dragging ? 'Lepaskan untuk mengunggah' : 'Seret file ke sini'}
          </span>
          <span className="text-[13px] text-text-tertiary">
            atau{' '}
            <span className="font-semibold text-accent-text underline underline-offset-2">
              klik untuk memilih
            </span>{' '}
            · .xlsx atau .xls
          </span>
        </div>
      )}

      {hint ? (
        <p id={hintId} className="text-[13px] text-text-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
