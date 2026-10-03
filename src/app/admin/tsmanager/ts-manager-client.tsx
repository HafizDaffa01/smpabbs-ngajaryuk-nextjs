'use client'

import { useMemo, useState } from 'react'
import {
  BookOpenCheck,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
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
import { Field, Input, Label, Select, Textarea } from '@/components/ui/input'
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

/** `profiles.mapel` is keyed by class; the value is one subject or a list. */
type MapelValue = string | string[]
type MapelRecord = Record<string, MapelValue>

interface TsManagerClientProps {
  teachers: Teacher[]
}

type MapelFilter = 'all' | 'assigned' | 'unassigned'

function hasMapel(teacher: Teacher): boolean {
  return Object.keys(teacher.mapel ?? {}).length > 0
}

export default function TsManagerClient({ teachers: initialTeachers }: TsManagerClientProps) {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers)
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [editingMapel, setEditingMapel] = useState<Teacher | null>(null)
  const [mapelJson, setMapelJson] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [mapelFilter, setMapelFilter] = useState<MapelFilter>('all')
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null)

  const filteredTeachers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return teachers.filter((teacher) => {
      const matchesQuery =
        !query ||
        teacher.name.toLowerCase().includes(query) ||
        teacher.email?.toLowerCase().includes(query)

      const matchesMapel =
        mapelFilter === 'all' ||
        (mapelFilter === 'assigned' ? hasMapel(teacher) : !hasMapel(teacher))

      return Boolean(matchesQuery) && matchesMapel
    })
  }, [teachers, searchQuery, mapelFilter])

  const unassignedCount = teachers.filter((teacher) => !hasMapel(teacher)).length

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
      setTeachers((prev) => prev.filter((t) => t.id !== id))
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
      setTeachers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_admin: true } : t))
      )
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
      setTeachers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_admin: false } : t))
      )
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(null)
    }
  }

  async function handleUpdateTeacher(teacher: Teacher, updates: Partial<Teacher> & { password?: string }) {
    setLoading(teacher.id)
    setMessage(null)

    try {
      const body: Record<string, unknown> = { ...updates }
      if (!updates.password) {
        delete body.password
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

      setMessage({ type: 'success', text: 'Data guru berhasil diperbarui' })
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacher.id ? { ...t, ...updates } : t))
      )
      setEditingTeacher(null)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(null)
    }
  }

  function openMapelEditor(teacher: Teacher) {
    setEditingMapel(teacher)
    setMapelJson(JSON.stringify(teacher.mapel || {}, null, 2))
  }

  async function handleSaveMapel() {
    if (!editingMapel) return

    setLoading(editingMapel.id)
    setMessage(null)

    try {
      const parsed = JSON.parse(mapelJson)

      const response = await fetch(`/api/admin/teachers/${editingMapel.id}/mapel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mapel: parsed }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui mapel')
      }

      setMessage({ type: 'success', text: 'Mapel berhasil diperbarui' })
      setTeachers((prev) =>
        prev.map((t) => (t.id === editingMapel.id ? { ...t, mapel: parsed } : t))
      )
      setEditingMapel(null)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Format JSON tidak valid',
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

      {unassignedCount > 0 ? (
        <FeedbackBanner tone="info">
          {unassignedCount} guru belum memiliki mapel. Gunakan tombol “Mapel” untuk menugaskan.
        </FeedbackBanner>
      ) : null}

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Daftar Guru</CardTitle>
            <CardDescription>
              {filteredTeachers.length} dari {teachers.length} guru ditampilkan
            </CardDescription>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <div className="w-full sm:w-56">
              <Label htmlFor="tsSearch">Cari guru</Label>
              <Input
                id="tsSearch"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Nama atau email…"
                className="mt-1.5"
              />
            </div>

            <div className="w-full sm:w-44">
              <Label htmlFor="tsMapelFilter">Mapel</Label>
              <div className="mt-1.5">
                <Select
                  id="tsMapelFilter"
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
            <ButtonLink href="/admin/import-teachers" variant="secondary">
              Import Guru
            </ButtonLink>
          </div>
        </CardHeader>

        <CardContent>
          {showAddForm ? (
            <AddTeacherForm
              onClose={() => setShowAddForm(false)}
              onSuccess={(newTeacher) => {
                setTeachers((prev) => [...prev, newTeacher])
                setShowAddForm(false)
              }}
            />
          ) : null}

          {filteredTeachers.length === 0 ? (
            <EmptyState
              title={
                searchQuery || mapelFilter !== 'all'
                  ? 'Tidak ada guru yang cocok dengan pencarian.'
                  : 'Belum ada data guru.'
              }
              description={
                searchQuery || mapelFilter !== 'all'
                  ? 'Coba kata kunci lain atau setel ulang filter mapel.'
                  : 'Tambahkan guru satu per satu, atau impor dari berkas Excel.'
              }
            />
          ) : (
            <TableScroll label="Daftar guru dan mapel" maxHeight="34rem">
              {loading ? (
                <p role="status" className="sr-only">
                  Memproses permintaan…
                </p>
              ) : null}
              <Table className="min-w-[760px]">
                <TableCaption>Daftar guru, mapel, dan role</TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-surface-sunken">
                    <TableHead>Guru</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-44 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`} className="hover:bg-surface-sunken">
                        <TableCell colSpan={4}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    filteredTeachers.map((teacher) => {
                      const busy = loading === teacher.id
                      const isEditingRow = editingTeacher?.id === teacher.id
                      const entries = Object.entries(teacher.mapel ?? {})

                      return (
                        <TableRow key={teacher.id}>
                          <TableCell>
                            {isEditingRow ? (
                              <Input
                                type="text"
                                defaultValue={teacher.name}
                                onBlur={(e) =>
                                  handleUpdateTeacher(teacher, { name: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateTeacher(teacher, { name: e.currentTarget.value })
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <Avatar name={teacher.name} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-text-primary">
                                    {teacher.name}
                                  </p>
                                  {isEditingRow ? (
                                    <Input
                                      type="email"
                                      defaultValue={teacher.email || ''}
                                      onBlur={(e) =>
                                        handleUpdateTeacher(teacher, { email: e.target.value })
                                      }
                                      className="mt-1"
                                    />
                                  ) : (
                                    <p className="truncate text-[13px] text-text-tertiary">
                                      {teacher.email || '-'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {isEditingRow ? (
                              <Input
                                type="tel"
                                defaultValue={teacher.phone_num || ''}
                                placeholder="No. WhatsApp"
                                onBlur={(e) =>
                                  handleUpdateTeacher(teacher, {
                                    phone_num: e.target.value || null,
                                  })
                                }
                                className="mt-2 w-full sm:w-48"
                              />
                            ) : null}
                          </TableCell>

                          <TableCell>
                            {entries.length === 0 ? (
                              <span className="flex items-center gap-1.5 text-[13px] text-warning-text">
                                <span aria-hidden className="size-1.5 rounded-full bg-warning-text" />
                                Belum ada mapel
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {entries.map(([kelas, mapel]) => (
                                  <div key={kelas} className="flex flex-wrap items-center gap-1">
                                    <span className="meta shrink-0">{kelas}</span>
                                    {(Array.isArray(mapel) ? mapel : [mapel]).map((subject) => (
                                      <Badge key={subject} variant="info">
                                        {subject}
                                      </Badge>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge variant={teacher.is_admin ? 'accent' : 'success'}>
                              {teacher.is_admin ? 'Admin' : 'Guru'}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant={entries.length === 0 ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => openMapelEditor(teacher)}
                                disabled={busy}
                                aria-label={`Atur mapel untuk ${teacher.name}`}
                              >
                                <BookOpenCheck aria-hidden className="size-4" />
                                Mapel
                              </Button>

                              <Dropdown align="end">
                                <DropdownTrigger
                                  disabled={busy}
                                  aria-label={`Aksi lainnya untuk ${teacher.name}`}
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
                                    onClick={() =>
                                      setEditingTeacher(
                                        editingTeacher?.id === teacher.id ? null : teacher
                                      )
                                    }
                                    disabled={busy}
                                  >
                                    <Pencil aria-hidden className="size-4 shrink-0" />
                                    {isEditingRow ? 'Selesai' : 'Edit'}
                                  </DropdownItem>
                                  {teacher.is_admin ? (
                                    <DropdownItem
                                      onClick={() => handleRemoveAdmin(teacher.id)}
                                      disabled={busy}
                                    >
                                      <ShieldOff aria-hidden className="size-4 shrink-0" />
                                      Jadikan Guru
                                    </DropdownItem>
                                  ) : (
                                    <DropdownItem
                                      onClick={() => handleMakeAdmin(teacher.id)}
                                      disabled={busy}
                                    >
                                      <ShieldCheck aria-hidden className="size-4 shrink-0" />
                                      Jadikan Admin
                                    </DropdownItem>
                                  )}
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
                            </div>
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

      {editingMapel ? (
        <MapelDialog
          teacher={editingMapel}
          json={mapelJson}
          onJsonChange={setMapelJson}
          loading={loading === editingMapel.id}
          onSave={handleSaveMapel}
          onClose={() => setEditingMapel(null)}
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
          Apakah Anda yakin ingin menghapus guru ini? Semua data absensi terkait juga akan dihapus.
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

/**
 * Assignment form. The JSON textarea stays the single source of truth for what
 * gets PUT, but the structured rows above it write into that same text, so a
 * teacher can be assigned without hand-writing braces.
 */
function MapelDialog({
  teacher,
  json,
  onJsonChange,
  loading,
  onSave,
  onClose,
}: {
  teacher: Teacher
  json: string
  onJsonChange: (value: string) => void
  loading: boolean
  onSave: () => void
  onClose: () => void
}) {
  const [kelas, setKelas] = useState('')
  const [mapel, setMapel] = useState('')

  const parsed = useMemo<MapelRecord | null>(() => {
    try {
      const value = JSON.parse(json)
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      return value as MapelRecord
    } catch {
      return null
    }
  }, [json])

  const entries = parsed ? Object.entries(parsed) : []

  function commit(next: MapelRecord) {
    onJsonChange(JSON.stringify(next, null, 2))
  }

  function handleAssign() {
    const key = kelas.trim().toUpperCase()
    const values = mapel
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (!parsed || !key || values.length === 0) return

    const existing = parsed[key]
    const current = existing
      ? Array.isArray(existing)
        ? existing
        : [existing]
      : []

    commit({ ...parsed, [key]: Array.from(new Set([...current, ...values])) })
    setKelas('')
    setMapel('')
  }

  function handleRemove(key: string, subject?: string) {
    if (!parsed) return

    if (!subject) {
      const rest = { ...parsed }
      delete rest[key]
      commit(rest)
      return
    }

    const existing = parsed[key]
    const current = existing ? (Array.isArray(existing) ? existing : [existing]) : []
    const remaining = current.filter((item) => item !== subject)

    if (remaining.length === 0) {
      const rest = { ...parsed }
      delete rest[key]
      commit(rest)
      return
    }

    commit({ ...parsed, [key]: remaining })
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="lg"
      title={`Atur Mapel — ${teacher.name}`}
      description="Tambahkan kelas dan mapel, atau hapus penugasan yang sudah ada."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={onSave} loading={loading} loadingText="Menyimpan...">
            Simpan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section aria-labelledby="mapel-current" className="flex flex-col gap-3">
          <h3 id="mapel-current" className="eyebrow">
            Penugasan saat ini
          </h3>

          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed border-border-default bg-surface-sunken px-4 py-6 text-center">
              <p className="text-sm font-semibold text-text-primary">
                Belum ada mapel untuk {teacher.name}
              </p>
              <p className="mt-1 text-[13px] text-text-tertiary">
                Tambahkan kelas dan mapel di bawah untuk mulai menugaskan.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map(([key, value]) => {
                const list = Array.isArray(value) ? value : [value]
                return (
                  <li
                    key={key}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-surface-card px-3 py-2"
                  >
                    <span className="meta shrink-0">{key}</span>
                    {list.map((subject) => (
                      <span key={subject} className="flex items-center gap-1">
                        <Badge variant="info">{subject}</Badge>
                        <button
                          type="button"
                          onClick={() => handleRemove(key, subject)}
                          aria-label={`Hapus mapel ${subject} pada kelas ${key}`}
                          className="focus-ring inline-flex size-6 items-center justify-center rounded-sm text-text-tertiary transition-colors duration-150 ease-out hover:bg-danger-bg hover:text-danger-text"
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleRemove(key)}
                      className="focus-ring ml-auto rounded-sm px-1.5 py-0.5 text-[13px] font-medium text-danger-text transition-colors duration-150 ease-out hover:underline"
                    >
                      Hapus kelas
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="mapel-assign" className="flex flex-col gap-3">
          <h3 id="mapel-assign" className="eyebrow">
            Tambah penugasan
          </h3>

          {parsed ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field id="assignKelas" label="Kelas" className="sm:w-32">
                {(field) => (
                  <Input
                    {...field}
                    value={kelas}
                    onChange={(event) => setKelas(event.target.value)}
                    placeholder="7A"
                  />
                )}
              </Field>
              <Field
                id="assignMapel"
                label="Mapel"
                className="flex-1"
                hint="Pisahkan beberapa mapel dengan koma."
              >
                {(field) => (
                  <Input
                    {...field}
                    value={mapel}
                    onChange={(event) => setMapel(event.target.value)}
                    placeholder="Matematika, IPA"
                  />
                )}
              </Field>
              <Button
                onClick={handleAssign}
                disabled={!kelas.trim() || !mapel.trim()}
              >
                <Plus aria-hidden className="size-4" />
                Assign
              </Button>
            </div>
          ) : (
            <FeedbackBanner tone="error">
              Isi JSON tidak valid atau bukan objek. Perbaiki formatnya di bawah agar penugasan
              dapat dipakai lagi.
            </FeedbackBanner>
          )}
        </section>

        <section aria-labelledby="mapel-raw" className="flex flex-col gap-2">
          <h3 id="mapel-raw" className="eyebrow">
            JSON mentah
          </h3>
          <Textarea
            value={json}
            onChange={(event) => onJsonChange(event.target.value)}
            rows={8}
            spellCheck={false}
            className="font-mono text-[13px]"
            aria-describedby="mapel-raw-hint"
          />
          <p id="mapel-raw-hint" className="text-[13px] text-text-tertiary">
            Format JSON: {'{ "Kelas": ["Mapel1", "Mapel2"], ... }'}
          </p>
        </section>
      </div>
    </Dialog>
  )
}

function AddTeacherForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (teacher: Teacher) => void
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

      onSuccess({
        id: data.user?.id || '',
        name,
        email,
        phone_num: phoneNum || null,
        is_admin: false,
      })
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
      <div className="flex items-center gap-2">
        <UserPlus aria-hidden className="size-4 text-accent-text" />
        <h3 className="text-sm font-semibold text-text-primary">Tambah Guru Baru</h3>
      </div>

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
