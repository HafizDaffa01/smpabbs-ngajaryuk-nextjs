import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LoginForm from './login-form'

export const metadata = {
  title: 'Login - NgajarYuk',
  description: 'Login ke sistem NgajarYuk',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    redirect('/')
  }

  const params = await searchParams
  const message = params?.message ?? null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md dark:bg-zinc-900">
        <h1 className="mb-6 text-2xl font-bold text-center text-zinc-900 dark:text-zinc-50">
          Login - NgajarYuk
        </h1>
        <LoginForm message={message} />
      </div>
    </div>
  )
}
