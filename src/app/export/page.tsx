import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Backup & Export - NgajarYuk',
  description: 'Export dan backup data',
}

export default async function BackupPage() {
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Backup & Export Data
          </h1>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Export CSV */}
            <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Export Presensi (CSV)
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Export data presensi guru dalam format CSV
              </p>
              <form action="/export?type=csv" method="GET" className="mt-4">
                <div className="flex gap-2">
                  <select
                    name="month"
                    className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Semua Bulan</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {new Date(2025, m - 1).toLocaleDateString('id-ID', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select
                    name="year"
                    className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Download CSV
                </button>
              </form>
            </div>

            {/* Export ZIP */}
            <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Export Foto (ZIP)
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Download semua foto presensi dalam format ZIP
              </p>
              <form action="/export?type=zip" method="GET" className="mt-4">
                <button
                  type="submit"
                  className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                >
                  Download ZIP
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
