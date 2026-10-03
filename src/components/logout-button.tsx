'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type LogoutButtonProps = {
  /**
   * Extra classes merged after the primitive's own classes, so a caller can
   * still widen or recolour it (tailwind-merge makes the last value win).
   */
  className?: string
  /** Accessible/tooltip text; also the icon-only tooltip below `sm`. */
  title?: string
}

/**
 * Standalone logout button used by the top navbar. Calls the same
 * `POST /api/auth/logout` handler the admin shell uses, then hard-navigates to
 * `/login` and refreshes the router cache so no protected RSC output lingers.
 *
 * Props and behaviour are unchanged — `className` and `title` are still the
 * only knobs, the request is still `POST /api/auth/logout`, and the button is
 * still disabled for the whole round-trip so a double tap cannot fire two
 * logouts. Only the styling moved from the legacy `.navbar-logout-btn` rules
 * to the `Button` primitive.
 */
export default function LogoutButton({
  className,
  title = 'Keluar dari akun',
}: LogoutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    if (loading) return
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch {
      console.error('Logout failed')
      setLoading(false)
    }
  }

  return (
    <Button
      variant="subtle"
      onClick={handleLogout}
      loading={loading}
      loadingText="Memproses…"
      title={title}
      aria-label="Keluar"
      className={cn(
        'px-3 text-[13px] text-danger-text',
        'hover:bg-danger-bg hover:text-danger-text',
        className
      )}
    >
      {/* While `loading` is set the primitive swaps this for a spinner plus
          `loadingText`, so the label is never rendered twice. */}
      <LogOut aria-hidden className="size-4" />
      {/* Icon-only on the narrowest screens; `title` keeps it discoverable. */}
      <span className="hidden sm:inline">Logout</span>
    </Button>
  )
}