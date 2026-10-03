import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import TsManagerClient from './ts-manager-client'

export const metadata = {
  title: 'TS Manager - NgajarYuk',
  description: 'Manajemen lengkap guru',
}

export default async function TsManagerPage() {
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

  // Fetch all teachers (including admins for full management)
  const { data: teachers } = await supabase
    .from('profiles')
    .select('*')
    .order('is_admin', { ascending: false })
    .order('name')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="TS Manager"
        crumbs={[
          { label: 'Beranda', href: '/' },
          { label: 'Admin', href: '/admin' },
          { label: 'TS Manager' },
        ]}
        description="Kelola akun guru dan penugasan mapel. Guru tanpa mapel ditandai jelas agar mudah ditindaklanjuti."
      />

      <TsManagerClient teachers={teachers ?? []} />
    </div>
  )
}
