import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Mail, Phone, ShieldCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import ProfileForm from './profile-form'

export const metadata = {
  title: 'Profil',
  description: 'Kelola profil dan password',
}

export default async function ProfilePage() {
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
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader
        title="Profil Saya"
        crumbs={[{ label: 'Beranda', href: '/' }, { label: 'Profil' }]}
        description="Kelola informasi kontak dan keamanan akun Anda."
        actions={
          <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2 shadow-xs">
            <Avatar name={profile.name} size="lg" />
            <div className="flex min-w-0 flex-col items-start gap-1">
              <span className="max-w-40 truncate text-sm font-semibold text-text-primary">
                {profile.name}
              </span>
              <Badge variant={profile.is_admin ? 'accent' : 'success'}>
                {profile.is_admin ? 'Admin' : 'Guru'}
              </Badge>
            </div>
          </div>
        }
      />

      <ProfileForm profile={profile} email={user.email ?? ''} />

      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-text-tertiary">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        Perubahan nomor WhatsApp dipakai untuk mengirim notifikasi presensi dan jadwal
        mengajar. Pastikan nomornya aktif.
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <Mail aria-hidden className="size-3.5" />
          {user.email ?? ''}
        </span>
        {profile.phone_num ? (
          <span className="flex items-center gap-1.5">
            <Phone aria-hidden className="size-3.5" />
            {profile.phone_num}
          </span>
        ) : null}
      </div>
    </div>
  )
}
