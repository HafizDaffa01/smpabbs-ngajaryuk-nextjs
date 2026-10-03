'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Lock, Mail, MessageCircle, Save, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { useToast } from '@/components/toast-provider'

type Profile = {
  id: string
  name: string
  phone_num?: string | null
  is_admin: boolean
}

interface ProfileFormProps {
  profile: Profile
  email: string
}

/**
 * Validation messages are kept as module constants so each message can also be
 * routed to the field it belongs to (`Field` renders a single error string).
 * The text itself is unchanged.
 */
const ERR_MIN_LENGTH = 'Password baru minimal 8 karakter'
const ERR_COMPLEXITY = 'Password harus mengandung huruf besar, huruf kecil, dan angka'
const ERR_MISMATCH = 'Password konfirmasi tidak cocok'

/** `Input` with a leading lucide icon, replacing the old `.icon-box` group. */
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
      <Input className={`pl-9 ${className ?? ''}`} {...props} />
    </div>
  )
}

export default function ProfileForm({ profile, email }: ProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const router = useRouter()
  const { addToast } = useToast()

  const [phoneNum, setPhoneNum] = useState(profile.phone_num ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])

  async function handleUpdateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_num: phoneNum || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        addToast('error', data.error || 'Gagal memperbarui profil')
        return
      }

      addToast('success', 'Profil berhasil diperbarui!')
      router.refresh()
    } catch {
      addToast('error', 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  function validatePassword() {
    const errors: string[] = []

    if (newPassword.length < 8) {
      errors.push(ERR_MIN_LENGTH)
    }

    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      errors.push(ERR_COMPLEXITY)
    }

    if (newPassword !== confirmPassword) {
      errors.push(ERR_MISMATCH)
    }

    setPasswordErrors(errors)
    return errors.length === 0
  }

  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordLoading(true)
    setPasswordErrors([])

    if (!validatePassword()) {
      setPasswordLoading(false)
      return
    }

    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        addToast('error', data.error || 'Gagal memperbarui password')
        return
      }

      addToast('success', 'Password berhasil diubah!')

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordErrors([])
      if (event.target instanceof HTMLFormElement) {
        event.target.reset()
      }
    } catch {
      addToast('error', 'Terjadi kesalahan')
    } finally {
      setPasswordLoading(false)
    }
  }

  // Each rule is shown next to the field it applies to.
  const newPasswordError = [ERR_MIN_LENGTH, ERR_COMPLEXITY]
    .filter((message) => passwordErrors.includes(message))
    .join(' · ')
  const confirmPasswordError = passwordErrors.includes(ERR_MISMATCH) ? ERR_MISMATCH : undefined

  return (
    <div className="flex flex-col gap-4">
      {/* Update Profil */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Update Profil</CardTitle>
            <CardDescription>
              Nama dan email hanya dapat diubah oleh Admin. Nomor WhatsApp bisa Anda perbarui
              sendiri.
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleUpdateProfile}>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="name" label="Nama Lengkap" hint="Nama hanya dapat diubah oleh Admin.">
                {(field) => (
                  <IconInput
                    {...field}
                    icon={User}
                    name="name"
                    type="text"
                    value={profile.name}
                    disabled
                    autoComplete="name"
                  />
                )}
              </Field>

              <Field id="email" label="Alamat Email">
                {(field) => (
                  <IconInput
                    {...field}
                    icon={Mail}
                    name="email"
                    type="email"
                    value={email}
                    disabled
                    autoComplete="email"
                  />
                )}
              </Field>
            </div>

            <Field
              id="phone_num"
              label="Nomor WhatsApp"
              hint="Dipakai untuk notifikasi presensi dan jadwal mengajar. Kosongkan bila tidak ingin menerima notifikasi."
            >
              {(field) => (
                <IconInput
                  {...field}
                  icon={MessageCircle}
                  name="phone_num"
                  type="tel"
                  value={phoneNum}
                  onChange={(e) => setPhoneNum(e.target.value)}
                  placeholder="08123456789"
                  autoComplete="tel"
                />
              )}
            </Field>

            <div>
              <Button type="submit" loading={loading} loadingText="Menyimpan...">
                <Save aria-hidden className="size-4" />
                Update Profil
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {/* Update Password */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Update Password</CardTitle>
            <CardDescription>
              Minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleUpdatePassword}>
          <CardContent className="flex flex-col gap-4">
            <Field
              id="current_password"
              label="Password Saat Ini"
              hint="Masukkan password yang sedang dipakai untuk masuk."
              required
            >
              {(field) => (
                <IconInput
                  {...field}
                  icon={Lock}
                  name="current_password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              )}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="password"
                label="Password Baru"
                error={newPasswordError || undefined}
                hint="Kombinasikan huruf besar, huruf kecil, dan angka."
                required
              >
                {(field) => (
                  <IconInput
                    {...field}
                    icon={KeyRound}
                    name="password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                )}
              </Field>

              <Field
                id="password_confirmation"
                label="Konfirmasi Password Baru"
                error={confirmPasswordError}
                required
              >
                {(field) => (
                  <IconInput
                    {...field}
                    icon={KeyRound}
                    name="password_confirmation"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                )}
              </Field>
            </div>

            <div>
              <Button type="submit" loading={passwordLoading} loadingText="Menyimpan...">
                <Save aria-hidden className="size-4" />
                Update Password
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
