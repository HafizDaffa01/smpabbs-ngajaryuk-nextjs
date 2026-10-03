'use client'

import { useState } from 'react'
import {
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Field, Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

const ROW_ACTIONS = 'Aksi guru'

export default function UserTable({ users }: UserTableProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  async function handleDeleteUser(id: string) {
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
      setDeletingUser(null)
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
    <div className="flex flex-col gap-4">
      {message ? (
        <FeedbackBanner tone={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </FeedbackBanner>
      ) : null}

      <div className="flex justify-end">
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          aria-expanded={showAddForm}
        >
          {showAddForm ? 'Batal' : 'Tambah Guru'}
        </Button>
      </div>

      {showAddForm ? (
        <AddUserForm onClose={() => setShowAddForm(false)} />
      ) : null}

      {users.length === 0 ? (
        <EmptyState
          title="Belum ada data pengguna."
          description="Gunakan tombol “Tambah Guru” untuk membuat akun pertama."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table className="min-w-[720px]">
            <TableCaption>Daftar pengguna guru dan admin</TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-surface-sunken">
                <TableHead className="w-12">No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>No. WhatsApp</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-16 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user, index) => {
                const busy = loading === user.id

                return (
                  <TableRow key={user.id}>
                    <TableCell className="text-text-tertiary">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.name} size="sm" />
                        <span className="font-semibold text-text-primary">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.phone_num || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_admin ? 'accent' : 'success'}>
                        {user.is_admin ? 'Admin' : 'Guru'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dropdown align="end">
                        <DropdownTrigger
                          disabled={busy}
                          aria-label={`${ROW_ACTIONS} untuk ${user.name}`}
                          className="focus-ring inline-flex size-8 items-center justify-center rounded-sm border border-transparent text-text-secondary transition-colors duration-150 ease-out hover:border-border-default hover:bg-surface-hover hover:text-text-primary disabled:opacity-55"
                        >
                          <MoreHorizontal aria-hidden className="size-4" />
                        </DropdownTrigger>

                        <DropdownContent>
                          <DropdownLabel>{user.name}</DropdownLabel>
                          <DropdownSeparator />
                          <DropdownItem
                            onClick={() => setEditingUser(user)}
                            disabled={busy}
                          >
                            <Pencil aria-hidden className="size-4 shrink-0" />
                            Edit
                          </DropdownItem>
                          {user.is_admin ? (
                            <DropdownItem
                              onClick={() => handleRemoveAdmin(user.id)}
                              disabled={busy}
                            >
                              <ShieldOff aria-hidden className="size-4 shrink-0" />
                              Jadikan Guru
                            </DropdownItem>
                          ) : (
                            <DropdownItem
                              onClick={() => handleMakeAdmin(user.id)}
                              disabled={busy}
                            >
                              <ShieldCheck aria-hidden className="size-4 shrink-0" />
                              Jadikan Admin
                            </DropdownItem>
                          )}
                          <DropdownSeparator />
                          <DropdownItem
                            onClick={() => setDeletingUser(user)}
                            disabled={busy}
                            className="text-danger-text hover:bg-danger-bg hover:text-danger-text"
                          >
                            <Trash2 aria-hidden className="size-4 shrink-0" />
                            Hapus
                          </DropdownItem>
                        </DropdownContent>
                      </Dropdown>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {editingUser ? (
        <EditUserDialog user={editingUser} onClose={() => setEditingUser(null)} />
      ) : null}

      <Dialog
        open={deletingUser !== null}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        size="sm"
        title="Hapus pengguna"
        description="Tindakan ini tidak dapat dibatalkan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingUser(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              loading={loading === deletingUser?.id}
              onClick={() => deletingUser && handleDeleteUser(deletingUser.id)}
            >
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Apakah Anda yakin ingin menghapus pengguna ini? Semua data absensi terkait juga akan
          dihapus.
        </p>
        {deletingUser ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Avatar name={deletingUser.name} size="sm" />
            {deletingUser.name}
          </p>
        ) : null}
      </Dialog>
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
    <Card>
      <CardHeader>
        <CardTitle>Tambah Pengguna Baru</CardTitle>
        <CardDescription>
          Akun dibuat langsung di Supabase Auth dengan role guru.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? <FeedbackBanner tone="error">{error}</FeedbackBanner> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="name" label="Nama" required>
              {(field) => <Input {...field} name="name" type="text" required autoFocus />}
            </Field>
            <Field id="email" label="Email" required>
              {(field) => <Input {...field} name="email" type="email" required />}
            </Field>
            <Field id="password" label="Password" required>
              {(field) => <Input {...field} name="password" type="text" required />}
            </Field>
            <Field id="phone_num" label="No. WhatsApp (opsional)">
              {(field) => <Input {...field} name="phone_num" type="tel" />}
            </Field>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" loading={loading} loadingText="Menyimpan...">
              Simpan
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function EditUserDialog({ user, onClose }: { user: User; onClose: () => void }) {
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
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Edit Pengguna"
      description="Perubahan langsung tersimpan pada profil pengguna."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="edit-user-form" loading={loading} loadingText="Menyimpan...">
            Simpan
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? <FeedbackBanner tone="error">{error}</FeedbackBanner> : null}

        <Field id="name" label="Nama" required>
          {(field) => (
            <Input {...field} name="name" type="text" required defaultValue={user.name} autoFocus />
          )}
        </Field>
        <Field id="email" label="Email" required>
          {(field) => (
            <Input {...field} name="email" type="email" required defaultValue={user.email || ''} />
          )}
        </Field>
        <Field id="phone_num" label="No. WhatsApp">
          {(field) => (
            <Input {...field} name="phone_num" type="tel" defaultValue={user.phone_num || ''} />
          )}
        </Field>
        <Field
          id="password"
          label="Password Baru (opsional)"
          hint="Kosongkan jika tidak ingin mengubah"
        >
          {(field) => <Input {...field} name="password" type="text" />}
        </Field>
      </form>
    </Dialog>
  )
}
