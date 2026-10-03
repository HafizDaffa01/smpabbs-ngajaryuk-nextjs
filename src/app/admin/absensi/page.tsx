import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import AbsensiClient from './absensi-client'

export const metadata = {
  title: 'Backup Absensi - NgajarYuk',
  description: 'Kelola data absensi backup',
}

export default async function AdminAbsensiPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/unauthorized')
  }

  // Fetch teachers for the grid
  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('is_admin', false)
    .order('name')

  // Fetch distinct years and months for filtering
  const { data: absensis } = await supabase
    .from('absensis')
    .select('year, month')
    .order('year', { ascending: false })

  const years = [...new Set(absensis?.map((a) => a.year) || [])]
  const months = [...new Set(absensis?.map((a) => a.month) || [])].sort((a, b) => b - a)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Backup Absensi"
        crumbs={[
          { label: 'Beranda', href: '/' },
          { label: 'Admin', href: '/admin' },
          { label: 'Absensi' },
        ]}
        description="Rekap check-in guru per hari, detail tiap record, dan hapus data berdasarkan periode."
      />

      <AbsensiClient teachers={teachers ?? []} years={years} months={months} />
    </div>
  )
}
