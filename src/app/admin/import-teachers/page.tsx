import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import TeacherImportForm from './teacher-import-form'

export const metadata = {
  title: 'Import Guru - NgajarYuk',
  description: 'Import data guru dari Excel',
}

export default async function AdminImportTeachersPage() {
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Import Guru"
        crumbs={[
          { label: 'Beranda', href: '/' },
          { label: 'Admin', href: '/admin' },
          { label: 'Import Guru' },
        ]}
        description="Unggah data guru beserta mapel dari berkas Excel. Format A dan B dikenali otomatis."
      />

      <TeacherImportForm />
    </div>
  )
}
