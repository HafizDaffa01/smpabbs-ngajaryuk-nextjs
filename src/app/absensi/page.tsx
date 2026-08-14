import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AbsensiForm from './absensi-form'

export const metadata = {
  title: 'Presensi Guru - NgajarYuk',
  description: 'Halaman presensi guru',
}

export default async function AbsensiPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', session.user.id)
    .single()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Presensi Guru
          </h1>
          <AbsensiForm userName={profile?.name ?? 'Guru'} />
        </div>
      </main>
    </div>
  )
}
