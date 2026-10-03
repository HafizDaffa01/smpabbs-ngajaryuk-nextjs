import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = {
  title: 'Error - NgajarYuk',
  description: 'Terjadi kesalahan',
}

type ErrorPageProps = {
  /**
   * `message` is what the caller wants the teacher to read; `from` is where the
   * failed action originated so "Coba lagi" can actually retry it. Both were
   * unreadable before this signature existed, so the page always showed the
   * same hard-coded copy.
   */
  searchParams: Promise<{ message?: string; from?: string }>
}

/**
 * Only same-origin, absolute-path values are accepted, so a crafted
 * `?from=https://evil.example` cannot turn the retry button into an open
 * redirect. `//host` is rejected explicitly because it is protocol-relative.
 */
function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export default async function ErrorPage({ searchParams }: ErrorPageProps) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const message = params?.message ?? 'Terjadi kesalahan saat memproses permintaan Anda.'
  const returnTo = safeReturnPath(params?.from)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-canvas px-4 py-10">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-8 sm:px-8 sm:py-10">
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-full border border-danger-border bg-danger-bg text-danger-text"
          >
            <AlertTriangle className="size-8" />
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              Terjadi Kesalahan
            </h1>
            {/* The whole point of this route: say what actually failed. */}
            <p role="alert" className="text-sm leading-relaxed text-text-secondary">
              {message}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <ButtonLink
              href={returnTo}
              size="lg"
              className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
            >
              <RotateCcw aria-hidden className="size-4" />
              Coba lagi
            </ButtonLink>

            {returnTo === '/' ? null : (
              <ButtonLink
                href="/"
                variant="secondary"
                size="lg"
                className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
              >
                <Home aria-hidden className="size-4" />
                Kembali ke dashboard
              </ButtonLink>
            )}
          </div>

          <p className="text-[13px] text-text-tertiary">
            Jika masalah berlanjut, hubungi administrator sekolah.
          </p>
        </CardContent>
      </Card>

      <p className="mt-6 text-[13px] text-text-tertiary">
        <Link
          href="/"
          className="rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors duration-150 ease-out hover:text-accent-text"
        >
          NgajarYuk
        </Link>{' '}
        · SMP ABBS Surakarta
      </p>
    </div>
  )
}