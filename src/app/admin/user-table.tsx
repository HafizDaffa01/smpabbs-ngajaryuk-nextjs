'use client'

import { useState } from 'react'

type User = {
  id: string
  name: string
  email?: string
  phone_num?: string | null
  is_admin: boolean
}

interface UserTableProps {
  users: User[]
}

export default function UserTable({ users }: UserTableProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  async function handleDeleteUser(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini? Semua data absensi terkait juga akan dihapus.')) return

    setLoading(id)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/teachers/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghapus pengguna')
      }

      setMessage({ type: 'success', text: 'Pengguna berhasil dihapus' })
      window.location.reload()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(null)
    }
  }

  async function handleMakeAdmin(id: string) {
    setLoading(id)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/teachers/${id}/make-admin`, {
        method: 'PUT',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengubah role')
      }

      setMessage({ type: 'success', text: 'Pengguna berhasil dijadikan admin' })
      window.location.reload()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(null)
    }
  }

  async function handleRemoveAdmin(id: string) {
    setLoading(id)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/teachers/${id}/remove-admin`, {
        method: 'PUT',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengubah role')
      }

      setMessage({ type: 'success', text: 'Admin berhasil dijadikan guru' })
      window.location.reload()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-4 rounded-md p-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {showAddForm ? 'Batal' : 'Tambah Guru'}
        </button>
      </div>

      {showAddForm && (
        <AddUserForm onClose={() => setShowAddForm(false)} />
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-700">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800">
              <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                Nama
              </th>
              <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                Email
              </th>
              <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                No. WhatsApp
              </th>
              <th className="border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                Role
              </th>
              <th className="border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="border border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  Belum ada data pengguna.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                  {user.name}
                </td>
                <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                  {user.email || '-'}
                </td>
                <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                  {user.phone_num || '-'}
                </td>
                <td className="border border-zinc-300 px-4 py-2 text-center text-sm dark:border-zinc-700">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      user.is_admin
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    }`}
                  >
                    {user.is_admin ? 'Admin' : 'Guru'}
                  </span>
                </td>
                <td className="border border-zinc-300 px-4 py-2 text-center dark:border-zinc-700">
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    {user.is_admin ? (
                      <button
                        onClick={() => handleRemoveAdmin(user.id)}
                        disabled={loading === user.id}
                        className="rounded-md bg-yellow-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-yellow-700 disabled:opacity-50"
                      >
                        Jadikan Guru
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMakeAdmin(user.id)}
                        disabled={loading === user.id}
                        className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                      >
                        Jadikan Admin
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={loading === user.id}
                      className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  )
}

function AddUserForm({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const phoneNum = formData.get('phone_num') as string

    try {
      const response = await fetch('/api/admin/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, phone_num: phoneNum || null }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menambahkan pengguna')
      }

      onClose()
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
        Tambah Pengguna Baru
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nama
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="text"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="phone_num" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No. WhatsApp (opsional)
          </label>
          <input
            id="phone_num"
            name="phone_num"
            type="tel"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md bg-zinc-200 px-4 py-2 font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  )
}

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const phoneNum = formData.get('phone_num') as string
    const password = formData.get('password') as string

    try {
      const body: Record<string, unknown> = { name, email, phone_num: phoneNum || null }
      if (password) {
        body.password = password
      }

      const response = await fetch(`/api/admin/teachers/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui data pengguna')
      }

      onClose()
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
        <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
          Edit Pengguna
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nama
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={user.name}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={user.email || ''}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="phone_num" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              No. WhatsApp
            </label>
            <input
              id="phone_num"
              name="phone_num"
              type="tel"
              defaultValue={user.phone_num || ''}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password Baru (opsional)
            </label>
            <input
              id="password"
              name="password"
              type="text"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Kosongkan jika tidak ingin mengubah"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md bg-zinc-200 px-4 py-2 font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
