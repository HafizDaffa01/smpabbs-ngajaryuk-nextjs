import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UserTable from './user-table'

export const metadata = {
  title: 'Admin Dashboard - NgajarYuk',
  description: 'Dashboard admin',
}

export default async function AdminDashboardPage() {
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

  // Fetch statistics
  const { count: teachersCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin', false)

  const { count: adminsCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin', true)

  const { count: studentsCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })

  const { count: absensiCount } = await supabase
    .from('absensis')
    .select('*', { count: 'exact', head: true })

  // Fetch all users except the super admin
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .neq('name', 'AdminABBS')
    .order('is_admin', { ascending: false })
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Admin Dashboard
          </h1>

          {/* Statistics */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Total Admin
              </h3>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {adminsCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Total Guru
              </h3>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {teachersCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Total Siswa
              </h3>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {studentsCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Total Presensi
              </h3>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {absensiCount ?? 0}
              </p>
            </div>
          </div>

          {/* User Management */}
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Manajemen Pengguna
            </h2>
            <UserTable users={users ?? []} />
          </div>

          {/* Admin Actions */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/admin/import"
              className="rounded-lg border border-zinc-200 p-6 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Import Siswa
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Import data siswa dari Excel
              </p>
            </a>
            <a
              href="/admin/import-teachers"
              className="rounded-lg border border-zinc-200 p-6 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Import Guru
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Import data guru dari Excel
              </p>
            </a>
            <a
              href="/schedule"
              className="rounded-lg border border-zinc-200 p-6 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Jadwal Mengajar
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Kelola jadwal mengajar
              </p>
            </a>
            <a
              href="/export"
              className="rounded-lg border border-zinc-200 p-6 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Backup Data
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Export dan backup data
              </p>
            </a>
            <a
              href="/explorer"
              className="rounded-lg border border-zinc-200 p-6 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                File Explorer
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Kelola file uploads
              </p>
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
