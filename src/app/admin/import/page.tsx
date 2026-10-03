import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import ImportForm from './import-form'

export const metadata = {
  title: 'Import Siswa - NgajarYuk',
  description: 'Import data siswa dari Excel',
}

export default async function AdminImportPage() {
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
        title="Import Siswa"
        crumbs={[
          { label: 'Beranda', href: '/' },
          { label: 'Admin', href: '/admin' },
          { label: 'Import Siswa' },
        ]}
        description="Unggah data siswa dari berkas Excel. Satu baris = satu siswa, kolom pertama nama dan kolom kedua kelas."
      />

      <ImportForm />
    </div>
  )
}
