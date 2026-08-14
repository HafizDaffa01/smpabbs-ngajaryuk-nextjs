import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Dashboard - NgajarYuk',
  description: 'Dashboard NgajarYuk',
}

export default async function HomePage() {
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
    .select('*')
    .eq('id', session.user.id)
    .single()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-8 shadow-md dark:bg-zinc-900">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Selamat Datang, {profile?.name ?? 'User'}!
              </h1>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                {profile?.is_admin ? 'Admin Dashboard' : 'Dashboard Guru'}
              </p>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Logout
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Profil
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Kelola profil dan password Anda
              </p>
            </div>
            {profile?.is_admin && (
              <>
                <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Manajemen Guru
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Tambah, edit, dan kelola data guru
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Import Siswa
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Import data siswa dari Excel
                  </p>
                </div>
              </>
            )}
            <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Presensi
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Lihat dan kelola presensi
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Informasi Akun
            </h3>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Nama
                </dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  {profile?.name ?? '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  {session.user.email ?? '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Role
                </dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  {profile?.is_admin ? 'Admin' : 'Guru'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  )
}
