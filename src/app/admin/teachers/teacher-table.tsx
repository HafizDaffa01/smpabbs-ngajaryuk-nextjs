'use client'

import { useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { EmptyState } from '@/components/ui/empty-state'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Field, Input, Label, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from '@/components/ui/table'

type Teacher = {
  id: string
  name: string
  email?: string
  phone_num?: string | null
  is_admin: boolean
  mapel?: Record<string, string[]> | null
}

interface TeacherTableProps {
  teachers: Teacher[]
}

type MapelFilter = 'all' | 'assigned' | 'unassigned'

function hasMapel(teacher: Teacher): boolean {
  return Object.keys(teacher.mapel ?? {}).length > 0
}

function mapelCount(teacher: Teacher): number {
  return Object.values(teacher.mapel ?? {}).reduce((sum, list) => sum + list.length, 0)
}

export default function TeacherTable({ teachers }: TeacherTableProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mapelFilter, setMapelFilter] = useState<MapelFilter>('all')

  const filteredTeachers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return teachers.filter((teacher) => {
      const matchesQuery =
        !query ||
        teacher.name.toLowerCase().includes(query) ||
        teacher.email?.toLowerCase().includes(query) ||
        teacher.phone_num?.includes(query)

      const matchesMapel =
        mapelFilter === 'all' ||
        (mapelFilter === 'assigned' ? hasMapel(teacher) : !hasMapel(teacher))

      return matchesQuery && matchesMapel
    })
  }, [teachers, searchQuery, mapelFilter])

  async function handleDeleteTeacher(id: string) {
    setLoading(id)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/teachers/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghapus guru')
      }

      setMessage({ type: 'success', text: 'Guru berhasil dihapus' })
      setDeletingTeacher(null)
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

      setMessage({ type: 'success', text: 'Guru berhasil dijadikan admin' })
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

      {/* Filter + actions */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Daftar guru</CardTitle>
            <CardDescription>
              {filteredTeachers.length} dari {teachers.length} guru ditampilkan
            </CardDescription>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <div className="w-full sm:w-56">
              <Label htmlFor="teacherSearch">Cari guru</Label>
              <Input
                id="teacherSearch"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Nama, email, atau nomor…"
                className="mt-1.5"
              />
            </div>

            <div className="w-full sm:w-48">
              <Label htmlFor="mapelFilter">Mapel</Label>
              <div className="mt-1.5">
                <Select
                  id="mapelFilter"
                  value={mapelFilter}
                  onChange={(event) => setMapelFilter(event.target.value as MapelFilter)}
                >
                  <option value="all">Semua</option>
                  <option value="assigned">Sudah ada mapel</option>
                  <option value="unassigned">Belum ada mapel</option>
                </Select>
              </div>
            </div>

            <Button onClick={() => setShowAddForm(!showAddForm)} aria-expanded={showAddForm}>
              {showAddForm ? 'Batal' : 'Tambah Guru'}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {showAddForm ? (
            <AddTeacherForm onClose={() => setShowAddForm(false)} />
          ) : filteredTeachers.length === 0 ? (
            <EmptyState
              title={
                searchQuery || mapelFilter !== 'all'
                  ? 'Tidak ada guru yang cocok dengan pencarian.'
                  : 'Belum ada data guru.'
              }
              description={
                searchQuery || mapelFilter !== 'all'
                  ? 'Coba kata kunci lain atau setel ulang filter mapel.'
                  : 'Gunakan tombol “Tambah Guru” untuk membuat akun pertama.'
              }
            />
          ) : (
            <TableScroll label="Daftar guru" maxHeight="34rem">
              {loading ? (
                <p role="status" className="sr-only">
                  Memproses permintaan…
                </p>
              ) : null}
              <Table className="min-w-[680px]">
                <TableCaption>Daftar akun guru</TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-surface-sunken">
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Guru</TableHead>
                    <TableHead>No. WhatsApp</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-16 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* While a row action is in flight the rows are replaced by
                      placeholders of the same height, so nothing jumps. */}
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`} className="hover:bg-surface-sunken">
                        <TableCell colSpan={6}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    filteredTeachers.map((teacher, index) => {
                      const busy = loading === teacher.id
                      const subjects = mapelCount(teacher)

                      return (
                        <TableRow key={teacher.id}>
                          <TableCell className="text-text-tertiary">{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={teacher.name} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-text-primary">
                                  {teacher.name}
                                </p>
                                <p className="truncate text-[13px] text-text-tertiary">
                                  {teacher.email || '-'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{teacher.phone_num || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={hasMapel(teacher) ? 'info' : 'neutral'}>
                              {hasMapel(teacher) ? `${subjects} mapel` : 'Belum ada mapel'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={teacher.is_admin ? 'accent' : 'success'}>
                              {teacher.is_admin ? 'Admin' : 'Guru'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Dropdown align="end">
                              <DropdownTrigger
                                disabled={busy}
                                aria-label={`Aksi untuk ${teacher.name}`}
                                className={cn(
                                  'focus-ring inline-flex size-8 items-center justify-center rounded-sm',
                                  'border border-transparent text-text-secondary',
                                  'transition-colors duration-150 ease-out',
                                  'hover:border-border-default hover:bg-surface-hover hover:text-text-primary',
                                  'disabled:pointer-events-none disabled:opacity-55'
                                )}
                              >
                                <MoreHorizontal aria-hidden className="size-4" />
                              </DropdownTrigger>

                              <DropdownContent>
                                <DropdownLabel>{teacher.name}</DropdownLabel>
                                <DropdownSeparator />
                                <DropdownItem
                                  onClick={() => setEditingTeacher(teacher)}
                                  disabled={busy}
                                >
                                  <Pencil aria-hidden className="size-4 shrink-0" />
                                  Edit
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => handleMakeAdmin(teacher.id)}
                                  disabled={busy}
                                >
                                  <ShieldCheck aria-hidden className="size-4 shrink-0" />
                                  Jadikan Admin
                                </DropdownItem>
                                <DropdownSeparator />
                                <DropdownItem
                                  onClick={() => setDeletingTeacher(teacher)}
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
                    })
                  )}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>

      {editingTeacher ? (
        <EditTeacherDialog
          teacher={editingTeacher}
          onClose={() => setEditingTeacher(null)}
        />
      ) : null}

      <Dialog
        open={deletingTeacher !== null}
        onOpenChange={(open) => !open && setDeletingTeacher(null)}
        size="sm"
        title="Hapus guru"
        description="Akun dan seluruh data absensinya akan dihapus permanen."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingTeacher(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              loading={loading === deletingTeacher?.id}
              onClick={() => deletingTeacher && handleDeleteTeacher(deletingTeacher.id)}
            >
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Apakah Anda yakin ingin menghapus guru ini?
        </p>
        {deletingTeacher ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Avatar name={deletingTeacher.name} size="sm" />
            {deletingTeacher.name}
          </p>
        ) : null}
      </Dialog>
    </div>
  )
}

function AddTeacherForm({ onClose }: { onClose: () => void }) {
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
        throw new Error(data.error || 'Gagal menambahkan guru')
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
    <form
      onSubmit={handleSubmit}
      className="mb-4 flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-sunken p-4"
    >
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
  )
}

function EditTeacherDialog({
  teacher,
  onClose,
}: {
  teacher: Teacher
  onClose: () => void
}) {
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

      const response = await fetch(`/api/admin/teachers/${teacher.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui data guru')
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
      onOpenChange={(next) => !next && onClose()}
      title="Edit Guru"
      description="Perubahan langsung tersimpan pada profil guru."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            form="edit-teacher-form"
            loading={loading}
            loadingText="Menyimpan..."
          >
            Simpan
          </Button>
        </>
      }
    >
      <form id="edit-teacher-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? <FeedbackBanner tone="error">{error}</FeedbackBanner> : null}

        <Field id="name" label="Nama" required>
          {(field) => (
            <Input {...field} name="name" type="text" required defaultValue={teacher.name} autoFocus />
          )}
        </Field>
        <Field id="email" label="Email" required>
          {(field) => (
            <Input {...field} name="email" type="email" required defaultValue={teacher.email || ''} />
          )}
        </Field>
        <Field id="phone_num" label="No. WhatsApp">
          {(field) => (
            <Input {...field} name="phone_num" type="tel" defaultValue={teacher.phone_num || ''} />
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
