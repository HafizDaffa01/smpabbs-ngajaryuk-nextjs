import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { ButtonLink } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import ScheduleImportForm from '../import-form'

export const metadata = {
  title: 'Import Jadwal',
  description: 'Import jadwal dari Excel',
}

export default async function ScheduleImportPage() {
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
    <div className="flex flex-col gap-5 bg-surface-canvas text-text-primary">
      <PageHeader
        title="Import Jadwal"
        crumbs={[
          { label: 'Beranda', href: '/' },
          { label: 'Jadwal Mengajar', href: '/schedule' },
          { label: 'Import Jadwal' },
        ]}
        description="Upload file v9.4.xlsx dari aSc Timetables. File akan di-parse dan diimport ke database."
        actions={
          <ButtonLink href="/schedule" variant="secondary">
            <ArrowLeft aria-hidden className="size-4" />
            Kembali ke Jadwal
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Upload Berkas</CardTitle>
            <CardDescription>
              Pratinjau seluruh sheet ditampilkan lebih dulu, dan data baru ditulis ke
              database setelah kamu menekan &ldquo;Konfirmasi Import&rdquo;.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ScheduleImportForm />
        </CardContent>
      </Card>
    </div>
  )
}
