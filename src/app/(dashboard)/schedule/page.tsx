import { Suspense } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card'
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton'
import ScheduleBrowser from './schedule-browser'

export const metadata = {
  title: 'Jadwal Mengajar',
  description: 'Jadwal mingguan per kelas',
}

/**
 * `/schedule` is the only route that reads its filters from `useSearchParams()`,
 * which is only available in a `'use client'` module. `ScheduleBrowser` is
 * therefore that client component and must sit behind a `<Suspense>` boundary;
 * this Server Component page owns the boundary and the fallback skeleton.
 */
function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-5 bg-surface-canvas text-text-primary">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-9 w-48" />
          </div>
          <SkeletonTable rows={6} cols={6} />
        </CardContent>
      </Card>
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <ScheduleBrowser />
    </Suspense>
  )
}