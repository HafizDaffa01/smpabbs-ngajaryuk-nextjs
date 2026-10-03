'use client'

import { cn } from '@/lib/utils'
import { Card } from './card'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-sm bg-surface-sunken',
        'motion-reduce:animate-none',
        className
      )}
    />
  )
}

export function SkeletonText({ className, lines = 3 }: SkeletonProps & { lines?: number }) {
  const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-3/4', 'w-2/3']

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4', widths[index % widths.length])}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="size-10 shrink-0 rounded-md" />
        <div className="flex-1">
          <SkeletonText lines={2} />
        </div>
      </div>
    </Card>
  )
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <div className="w-full">
      <div className="mb-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="mb-3 flex gap-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
