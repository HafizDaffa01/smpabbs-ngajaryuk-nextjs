'use client'

import { getCurrentPeriod } from '@/lib/period-system'
import { Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function PeriodBadge() {
  const currentPeriod = getCurrentPeriod()

  return (
    <Badge
      variant="accent"
      className="flex items-center gap-1.5 font-mono font-semibold tracking-wider uppercase"
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-accent"
      />
      <Calendar className="size-3.5" />
      <span>{currentPeriod.label}</span>
    </Badge>
  )
}
