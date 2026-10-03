import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import TeacherTable from './teacher-table'

export const metadata = {
  title: 'Manajemen Guru - NgajarYuk',
  description: 'Kelola data guru',
}

export default async function AdminTeachersPage() {
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

  // Fetch teachers (non-admin users)
  const { data: teachers } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_admin', false)
    .order('name')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Manajemen Guru"
        crumbs={[
          { label: 'Beranda', href: '/' },
          { label: 'Admin', href: '/admin' },
          { label: 'Guru' },
        ]}
        description="Tambah, ubah, dan hapus akun guru. Perubahan role berlaku langsung pada halaman masuk guru."
      />

      <TeacherTable teachers={teachers ?? []} />
    </div>
  )
}
