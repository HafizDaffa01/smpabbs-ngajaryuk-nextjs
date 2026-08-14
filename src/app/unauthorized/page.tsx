import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Unauthorized - NgajarYuk',
  description: 'Akses ditolak',
}

export default async function UnauthorizedPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-center text-red-600 dark:text-red-400">
          Akses Ditolak
        </h1>
        <p className="mt-4 text-center text-zinc-600 dark:text-zinc-400">
          Anda tidak memiliki hak akses ke halaman ini.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
