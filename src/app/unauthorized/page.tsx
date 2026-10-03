import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Home, ShieldAlert } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = {
  title: 'Unauthorized - NgajarYuk',
  description: 'Akses ditolak',
}

type UnauthorizedPageProps = {
  /**
   * `from` is the page that bounced the user here. It was unreachable before —
   * this component took no props at all — so the escape hatch always pointed at
   * `/`, even when the teacher had simply opened a link to a page they are not
   * allowed to see. Same-origin values only, so it cannot become an open
   * redirect.
   */
  searchParams: Promise<{ from?: string; message?: string }>
}

function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export default async function UnauthorizedPage({ searchParams }: UnauthorizedPageProps) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const message = params?.message ?? 'Anda tidak memiliki hak akses ke halaman ini.'
  const returnTo = safeReturnPath(params?.from)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-canvas px-4 py-10">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-8 sm:px-8 sm:py-10">
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-full border border-warning-border bg-warning-bg text-warning-text"
          >
            <ShieldAlert className="size-8" />
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              Akses Ditolak
            </h1>
            <p role="alert" className="text-sm leading-relaxed text-text-secondary">
              {message}
            </p>
          </div>

          <ButtonLink href={returnTo} size="lg" className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto">
            <Home aria-hidden className="size-4" />
            Kembali ke dashboard
          </ButtonLink>

          <p className="text-[13px] text-text-tertiary">
            Hubungi administrator sekolah bila Anda merasa ini keliru.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}