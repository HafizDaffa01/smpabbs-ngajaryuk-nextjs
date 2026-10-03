'use client'

import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'

export type BarDatum = {
  /** Axis label, e.g. "Sen". */
  label: string
  value: number
  /** Longer description used by the screen-reader table. */
  description?: string
  isToday?: boolean
}

type BarChartProps = {
  data: BarDatum[]
  /** One-sentence summary for the `role="img"` element. */
  ariaLabel: string
  valueLabel?: string
  unit?: string
  className?: string
}

/**
 * Dependency-free weekly bar chart.
 *
 * Accessibility treatment: the visual marks are exposed as a single
 * `role="img"` with a spoken summary, while an exact, visually hidden
 * `<table>` sits *outside* that image role so assistive tech can read the real
 * numbers. Values are also printed above every bar, and "hari ini" is marked
 * with a caret plus a caption — so nothing is encoded by colour alone.
 */
export function BarChart({
  data,
  ariaLabel,
  valueLabel = 'Nilai',
  unit = '',
  className,
}: BarChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const max = Math.max(1, ...data.map((item) => item.value))

  if (total === 0) {
    return (
      <EmptyState
        title="Belum ada data"
        description="Tidak ada angka yang bisa ditampilkan untuk periode ini."
      />
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div>
        <p className="meta">
          Total {total.toLocaleString('id-ID')} {unit}
        </p>
      </div>

      {/* Visual marks — summarised for AT, exact values live in the table below. */}
      <div role="img" aria-label={ariaLabel}>
        <div className="flex h-44 items-end gap-1.5 sm:gap-3">
          {data.map((item) => {
            const percent = Math.round((item.value / max) * 100)
            return (
              <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
                <span
                  className={cn(
                    'meta text-center tabular-nums',
                    item.isToday ? 'font-bold text-accent-text' : 'text-text-secondary'
                  )}
                >
                  {item.value}
                </span>

                <span className="relative flex h-full items-end">
                  <span
                    className={cn(
                      'w-full rounded-t-sm transition-[height] duration-500 ease-[var(--ds-ease)] motion-reduce:transition-none',
                      item.isToday ? 'bg-accent' : 'bg-accent-300'
                    )}
                    style={{ height: `${Math.max(percent, 2)}%` }}
                  />
                </span>

                <span
                  className={cn(
                    'meta text-center',
                    item.isToday ? 'text-accent-text' : undefined
                  )}
                >
                  {item.isToday ? '▼' : ''}
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Exact values for assistive technology. */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Hari</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.label}>
              <th scope="row">
                {item.description ?? item.label}
                {item.isToday ? ' (hari ini)' : ''}
              </th>
              <td>
                {item.value} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
