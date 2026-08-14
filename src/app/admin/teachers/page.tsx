import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import TeacherTable from './teacher-table'

export const metadata = {
  title: 'Manajemen Guru - NgajarYuk',
  description: 'Kelola data guru',
}

export default async function AdminTeachersPage() {
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
    .select('is_admin')
    .eq('id', session.user.id)
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
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Manajemen Guru
            </h1>
            <a
              href="/admin"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Kembali
            </a>
          </div>

          <TeacherTable teachers={teachers ?? []} />
        </div>
      </main>
    </div>
  )
}
