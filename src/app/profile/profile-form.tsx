'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

export default function ProfileForm({ profile, email }: ProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  async function handleUpdateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    const phoneNum = formData.get('phone_num') as string

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone_num: phoneNum || null }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui profil')
      }

      setMessage({ type: 'success', text: 'Profil berhasil diperbarui!' })
      router.refresh()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    const currentPassword = formData.get('current_password') as string
    const newPassword = formData.get('password') as string
    const confirmPassword = formData.get('password_confirmation') as string

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Password konfirmasi tidak cocok' })
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ current_password: currentPassword, password: newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui password')
      }

      setMessage({ type: 'success', text: 'Password berhasil diubah!' })
      if (event.target instanceof HTMLFormElement) {
        event.target.reset()
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Profile Info */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Informasi Profil
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nama</dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{profile.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Email</dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Role</dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
              {profile.is_admin ? 'Admin' : 'Guru'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Update Phone */}
      <form onSubmit={handleUpdateProfile} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Update Nomor WhatsApp
        </h2>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="phone_num" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nomor WhatsApp
            </label>
            <input
              id="phone_num"
              name="phone_num"
              type="tel"
              defaultValue={profile.phone_num ?? ''}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white dark:focus:ring-white"
              placeholder="08123456789"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {loading ? 'Menyimpan...' : 'Update Profil'}
          </button>
        </div>
      </form>

      {/* Update Password */}
      <form onSubmit={handleUpdatePassword} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Update Password
        </h2>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="current_password" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password Saat Ini
            </label>
            <input
              id="current_password"
              name="current_password"
              type="password"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white dark:focus:ring-white"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password Baru
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white dark:focus:ring-white"
            />
          </div>
          <div>
            <label htmlFor="password_confirmation" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Konfirmasi Password Baru
            </label>
            <input
              id="password_confirmation"
              name="password_confirmation"
              type="password"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white dark:focus:ring-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {loading ? 'Menyimpan...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  )
}
