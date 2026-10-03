'use client'

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FeedbackTone = 'success' | 'error' | 'info'

const TONE_STYLES = {
  success: 'border-success-border bg-success-bg text-success-text',
  error: 'border-danger-border bg-danger-bg text-danger-text',
  info: 'border-info-border bg-info-bg text-info-text',
} as const

const TONE_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const

type FeedbackBannerProps = {
  tone?: FeedbackTone
  children: React.ReactNode
  /** Renders a dismiss button; the parent owns the cleared state. */
  onDismiss?: () => void
  className?: string
}

/**
 * Inline result feedback for a mutating action. Errors are announced
 * assertively (`role="alert"`), successes politely (`role="status"`) so a
 * screen reader is not interrupted by a confirmation the user did not ask for.
 * The icon carries the meaning alongside the colour.
 */
export function FeedbackBanner({
  tone = 'info',
  children,
  onDismiss,
  className,
}: FeedbackBannerProps) {
  const Icon = TONE_ICONS[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] font-medium',
        TONE_STYLES[tone],
        className
      )}
    >
      <Icon aria-hidden className="mt-px size-4 shrink-0" />
      <p className="min-w-0 flex-1 leading-relaxed">{children}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan"
          className="focus-ring -my-1 -mr-1 shrink-0 rounded-sm p-1 opacity-70 transition-opacity duration-150 ease-out hover:opacity-100"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
