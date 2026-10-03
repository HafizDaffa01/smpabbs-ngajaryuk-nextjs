import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AdminShell } from '@/components/admin/shell'

export const metadata = {
  title: 'Admin',
  description: 'Panel administrasi NgajarYuk',
}

/**
 * Dedicated admin shell. `(dashboard)/layout.tsx` only wraps `/`, so without
 * this every other route renders with no navigation chrome.
 *
 * Auth is re-verified here as a layout-level gate. The individual admin pages
 * keep their own guards — this is defence in depth, not a replacement.
 */
export default async function AdminLayout({
  children,
}: LayoutProps<'/admin'>) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/unauthorized')
  }

  return (
    <AdminShell
      user={{
        name: profile.name?.trim() || user.email || 'Administrator',
        email: user.email ?? null,
      }}
    >
      {children}
    </AdminShell>
  )
}
