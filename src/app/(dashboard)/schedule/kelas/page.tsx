import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { ButtonLink } from '@/components/ui/button'
import KelasContent from './kelas-content'

export const metadata = {
  title: 'Jadwal per Kelas',
  description: 'Jadwal mingguan per kelas — tiap kolom adalah hari, tiap baris adalah jam pelajaran ke-1 sampai 9.',
}

function KelasSkeleton() {
  return (
    <div className="flex flex-col gap-5 bg-surface-canvas text-text-primary">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-40 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-8 w-64 animate-pulse rounded-sm bg-surface-sunken" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-sm bg-surface-sunken" />
      </div>
      <div className="h-9 w-56 animate-pulse rounded-sm bg-surface-sunken" />
      <div className="h-72 w-full animate-pulse rounded-md border border-border-subtle bg-surface-card" />
    </div>
  )
}

/**
 * `/schedule/kelas` — per-class weekly timetable.
 *
 * Row axis = period 1–9, column axis = Senin–Sabtu, for one selected class.
 * This Server Component owns the `<Suspense>` boundary (the class selector
 * reads `searchParams`, which is only available in a `'use client'` module),
 * the auth guard, and the `PageHeader`. The heavy lifting lives in
 * `kelas-content.tsx`.
 *
 * Auth: `TeacherShell` never redirects, so every dashboard page keeps its own
 * guard — exactly as `absensi/page.tsx` does.
 */
export default async function KelasPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex flex-col gap-5 bg-surface-canvas text-text-primary">
      <PageHeader
        title="Jadwal per Kelas"
        crumbs={[{ label: 'Beranda', href: '/' }, { label: 'Jadwal Mengajar', href: '/schedule' }]}
        description="Pilih satu kelas untuk melihat jadwal mingguannya: tiap kolom adalah hari, tiap baris adalah jam pelajaran."
        actions={
          <ButtonLink href="/schedule" variant="secondary">
            <ArrowLeft aria-hidden className="size-4" />
            Kembali ke Jadwal
          </ButtonLink>
        }
      />

      <Suspense fallback={<KelasSkeleton />}>
        <KelasContent />
      </Suspense>
    </div>
  )
}