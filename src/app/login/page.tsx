import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { BookOpen, ShieldCheck } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import LoginForm from './login-form'

export const metadata = {
  title: 'Login - NgajarYuk',
  description: 'Login ke sistem NgajarYuk',
}

/**
 * `redirect` is set by `middleware.ts` when an unauthenticated visitor hits a
 * protected route. Only same-origin, non-protocol-relative paths are honoured,
 * so the param can never be used to bounce a user to another site.
 */
function safeRedirect(target: string | undefined): string | undefined {
  if (!target) return undefined
  if (!target.startsWith('/') || target.startsWith('//')) return undefined
  return target
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; redirect?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/')
  }

  const params = await searchParams
  const message = params?.message ?? null
  const redirectTo = safeRedirect(params?.redirect)

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-surface-canvas px-4 py-10 text-text-primary">
      {/* Ambient wash, built from the accent token so it follows the theme. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_38rem_at_50%_-10%,var(--ds-accent-subtle),transparent_70%)]"
      />

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative flex w-full max-w-sm flex-col gap-5">
        {/* School identity — this screen has no app shell, so it carries the brand. */}
        <header className="flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-lg bg-accent text-on-accent shadow-md"
          >
            <BookOpen className="size-6" />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-bold tracking-tight text-text-primary">NgajarYuk</p>
            <p className="text-[13px] text-text-tertiary">SMP ABBS Surakarta</p>
          </div>
        </header>

        <Card className="w-full">
          <CardHeader className="flex-col gap-1 text-center">
            <h1 className="text-lg font-semibold text-text-primary">Masuk ke akun Anda</h1>
            <CardDescription className="mt-0">Masuk untuk melanjutkan</CardDescription>
          </CardHeader>

          <CardContent>
            <LoginForm message={message} redirectTo={redirectTo} />
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-center text-[13px] text-text-tertiary">
              Gunakan email dan password akun guru yang terdaftar di SMP ABBS Surakarta.
            </p>
          </CardFooter>
        </Card>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-text-tertiary">
          <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
          Presensi, jurnal, dan jadwal mengajar guru
        </p>
      </div>
    </div>
  )
}
