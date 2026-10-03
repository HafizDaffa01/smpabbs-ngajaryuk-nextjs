import * as React from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Card } from './card'

export type TrendTone = 'positive' | 'negative' | 'neutral'

const trendVariants = cva(
  'inline-flex items-center gap-1 text-[13px] font-semibold',
  {
    variants: {
      tone: {
        positive: 'text-success-text',
        negative: 'text-danger-text',
        neutral: 'text-text-tertiary',
      },
    },
    defaultVariants: { tone: 'positive' },
  }
)

const TILE_TONES = {
  accent: 'bg-accent-subtle text-accent-subtle-text',
  info: 'bg-info-bg text-info-text',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
  neutral: 'bg-neutral-bg text-neutral-text',
} as const

type StatCardProps = React.ComponentProps<'div'> & {
  label: string
  value: React.ReactNode
  /** Rendered as a big tabular figure. */
  hint?: string
  icon?: React.ReactNode
  tone?: keyof typeof TILE_TONES
  trend?: { value: React.ReactNode; tone?: TrendTone }
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'accent',
  trend,
  className,
  ...props
}: StatCardProps) {
  const showIcon = trend ? trend.tone !== 'neutral' : true
  const TrendIcon = trend?.tone === 'negative' ? TrendingDown : TrendingUp

  return (
    <Card className={cn('p-4', className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="eyebrow">{label}</p>
          {/* A <div>, not a <p>: the value may be a loading placeholder. */}
          <div className="text-3xl leading-none font-bold text-text-primary tabular-nums">
            {value}
          </div>
          {trend ? (
            <span
              className={trendVariants({
                tone: trend.tone ?? 'positive',
              })}
            >
              {showIcon ? <TrendIcon aria-hidden className="size-3.5" /> : null}
              {trend.value}
            </span>
          ) : null}
          {hint ? <p className="text-[13px] text-text-tertiary">{hint}</p> : null}
        </div>

        {icon ? (
          <span
            aria-hidden
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-md',
              TILE_TONES[tone]
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  )
}
