'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Lock, Mail } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Field, Input } from '@/components/ui/input'

/**
 * This screen renders outside any app shell, so the `focus-ring` utility class
 * used by the primitives has no `[data-ds-shell]` ancestor to hang off. These
 * Tailwind-native equivalents keep keyboard focus visible here.
 */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** Mirrors the sanitising done in `page.tsx` — never push an off-site URL. */
function safeRedirect(target: string | undefined): string {
  if (!target) return '/'
  if (!target.startsWith('/') || target.startsWith('//')) return '/'
  return target
}

function IconInput({
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-tertiary"
      />
      <Input className={`pl-9 ${FOCUS} ${className ?? ''}`} {...props} />
    </div>
  )
}

export default function LoginForm({
  message,
  redirectTo,
}: {
  message: string | null
  redirectTo?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login gagal')
      }

      router.push(safeRedirect(redirectTo))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {message ? <FeedbackBanner tone="success">{message}</FeedbackBanner> : null}
      {error ? (
        <FeedbackBanner tone="error" onDismiss={() => setError(null)}>
          {error}
        </FeedbackBanner>
      ) : null}

      <Field id="email" label="Email" required>
        {(field) => (
          <IconInput
            {...field}
            icon={Mail}
            name="email"
            type="email"
            required
            placeholder="nama@contoh.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
          />
        )}
      </Field>

      <Field id="password" label="Password" required>
        {(field) => (
          <IconInput
            {...field}
            icon={Lock}
            name="password"
            type="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
        )}
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={loading}
        loadingText="Memproses..."
        className={`w-full ${FOCUS}`}
      >
        <LogIn aria-hidden className="size-4" />
        Login
      </Button>
    </form>
  )
}
