import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { AppShell } from '@/components/app-shell'

/**
 * Server wrapper that gives a teacher route the teacher chrome.
 *
 * Adoption is a three-line change: wrap a page's returned JSX.
 *
 * ```tsx
 * return (
 *   <TeacherShell>
 *     …
 *   </TeacherShell>
 * )
 * ```
 *
 * Unlike `src/app/admin/layout.tsx` this **never redirects**. An
 * unauthenticated visitor simply gets the page with no chrome, so routes that
 * must stay chrome-free (`/login`, `/unauthorized`, `/success`) can be wrapped
 * too, and each page keeps ownership of its own auth guard.
 */
export default async function TeacherShell({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <>{children}</>
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, is_admin')
    .eq('id', user.id)
    .single()

  return (
    <AppShell
      user={{
        name: profile?.name?.trim() || user.email || 'Guru',
        email: user.email ?? null,
        isAdmin: Boolean(profile?.is_admin),
      }}
    >
      {children}
    </AppShell>
  )
}