import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CheckCircle2, Home } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = {
  title: 'Success - NgajarYuk',
  description: 'Operasi berhasil',
}

type SuccessPageProps = {
  /** `message` lets the caller describe what succeeded. */
  searchParams: Promise<{ message?: string }>
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const message = params?.message ?? 'Operasi berhasil dilakukan.'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-canvas px-4 py-10">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-8 sm:px-8 sm:py-10">
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-full border border-success-border bg-success-bg text-success-text"
          >
            <CheckCircle2 className="size-8" />
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">Berhasil</h1>
            <p role="status" className="text-sm leading-relaxed text-text-secondary">
              {message}
            </p>
          </div>

          <ButtonLink href="/" size="lg" className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto">
            <Home aria-hidden className="size-4" />
            Kembali ke dashboard
          </ButtonLink>
        </CardContent>
      </Card>
    </div>
  )
}