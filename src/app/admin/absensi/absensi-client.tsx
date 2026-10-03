'use client'

import { Fragment, useState, useEffect, useMemo } from 'react'
import { Camera, CameraOff, MapPin, Trash2, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { EmptyState } from '@/components/ui/empty-state'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Field, Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
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
}

type AbsensiRecord = {
  id: number
  user_id: string
  nama: string
  lokasi: string
  alamat?: string | null
  foto?: string | null
  akurasi?: string | null
  waktu: string
  month: number
  year: number
  /** Present on the `absensis` row, though rarely written by the check-in API. */
  value?: string | null
}

type AbsensiClientProps = {
  teachers: Teacher[]
  years: number[]
  months: number[]
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

/** S / I / A grading. The letter plus the spelled-out word, never colour alone. */
const SIA_LABELS: Record<string, { word: string; variant: 'warning' | 'info' | 'danger' }> = {
  S: { word: 'Sakit', variant: 'warning' },
  I: { word: 'Izin', variant: 'info' },
  A: { word: 'Alpa', variant: 'danger' },
}

type CellState = 'complete' | 'time-location' | 'time' | 'location' | 'photo' | 'empty'

/**
 * Cell fills. Colour is only ever a second channel here: every state also has a
 * `title`, the legend spells it out, and the detail table below repeats it.
 */
const CELL_LOOKUP: Record<CellState, string> = {
  complete: 'border-success-border bg-success-bg',
  'time-location': 'border-warning-border bg-warning-bg',
  time: 'border-info-border bg-info-bg',
  location: 'border-neutral-border bg-neutral-bg',
  photo: 'border-accent-border bg-accent-subtle',
  empty: 'border-border-subtle bg-surface-sunken',
}

const CELL_STATES: { key: CellState; label: string }[] = [
  { key: 'complete', label: 'Lengkap (waktu, lokasi, foto)' },
  { key: 'time-location', label: 'Waktu + lokasi' },
  { key: 'time', label: 'Waktu saja' },
  { key: 'location', label: 'Lokasi saja' },
  { key: 'photo', label: 'Foto saja' },
]

function resolveState(record?: AbsensiRecord): CellState {
  if (!record) return 'empty'
  const hasTime = !!record.waktu
  const hasLocation = !!record.lokasi
  const hasImage = !!record.foto

  if (hasTime && hasLocation && hasImage) return 'complete'
  if (hasTime && hasLocation) return 'time-location'
  if (hasTime) return 'time'
  if (hasLocation) return 'location'
  if (hasImage) return 'photo'
  return 'empty'
}

export default function AbsensiClient({ teachers, years, months }: AbsensiClientProps) {
  const [absensiData, setAbsensiData] = useState<AbsensiRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all')
  const [dataType, setDataType] = useState<'all' | 'time' | 'location' | 'image'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<{ start: Date; end: Date } | null>(null)
  const [editingCell, setEditingCell] = useState<{ recordId: number; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  // Confirmation dialogs replace the old window.confirm() calls.
  const [pendingDelete, setPendingDelete] = useState<AbsensiRecord | null>(null)
  const [pendingDeletePeriod, setPendingDeletePeriod] = useState(false)
  const [pendingDeleteAll, setPendingDeleteAll] = useState(false)
  const [deleteImages, setDeleteImages] = useState(false)

  // Fetch absensi data
  useEffect(() => {
    async function fetchAbsensi() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedYear !== 'all') params.set('year', String(selectedYear))
        if (selectedMonth !== 'all') params.set('month', String(selectedMonth))

        const response = await fetch(`/api/admin/absensi?${params.toString()}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Gagal memuat data absensi')
        }

        setAbsensiData(data.absensis || [])
      } catch (err) {
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Terjadi kesalahan',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAbsensi()
  }, [selectedYear, selectedMonth])

  // Filter data
  const filteredData = useMemo(() => {
    let result = absensiData

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.nama.toLowerCase().includes(q) ||
          a.lokasi.toLowerCase().includes(q) ||
          a.alamat?.toLowerCase().includes(q)
      )
    }

    // Data type filter
    if (dataType !== 'all') {
      result = result.filter((a) => {
        if (dataType === 'time') return !!a.waktu
        if (dataType === 'location') return !!a.lokasi
        if (dataType === 'image') return !!a.foto
        return true
      })
    }

    return result
  }, [absensiData, searchQuery, dataType])

  const summary = useMemo(() => {
    const withPhoto = filteredData.filter((a) => !!a.foto).length
    const withoutLocation = filteredData.filter((a) => !a.lokasi).length
    const teacherIds = new Set(filteredData.map((a) => a.user_id))

    return {
      total: filteredData.length,
      teachers: teacherIds.size,
      withPhoto,
      photoRatio: filteredData.length === 0 ? 0 : Math.round((withPhoto / filteredData.length) * 100),
      withoutLocation,
    }
  }, [filteredData])

  async function handleDeleteRecord(id: number) {
    try {
      const response = await fetch(`/api/admin/absensi/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghapus absensi')
      }

      setMessage({ type: 'success', text: 'Absensi berhasil dihapus' })
      setPendingDelete(null)
      setAbsensiData((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    }
  }

  async function handleDeleteAll() {
    try {
      const response = await fetch(`/api/admin/absensi/delete-all?with_image=${deleteImages ? '1' : '0'}`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghapus semua absensi')
      }

      setMessage({ type: 'success', text: 'Semua absensi berhasil dihapus' })
      setPendingDeleteAll(false)
      setAbsensiData([])
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    }
  }

  async function handleDeleteByPeriod() {
    if (!selectedPeriod) {
      setMessage({ type: 'error', text: 'Pilih periode terlebih dahulu' })
      return
    }

    const month = selectedPeriod.start.getMonth() + 1
    const year = selectedPeriod.start.getFullYear()

    try {
      const response = await fetch('/api/admin/absensi/delete-by-period', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ month, year, with_image: deleteImages }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghapus absensi periode')
      }

      setMessage({ type: 'success', text: `Absensi ${MONTH_NAMES[month - 1]} ${year} berhasil dihapus` })
      setPendingDeletePeriod(false)
      setAbsensiData((prev) => prev.filter((a) => !(a.month === month && a.year === year)))
      setSelectedPeriod(null)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    }
  }

  function startInlineEdit(record: AbsensiRecord, field: string) {
    setEditingCell({ recordId: record.id, field })
    setEditValue(record[field as keyof AbsensiRecord]?.toString() || '')
  }

  async function saveInlineEdit() {
    if (!editingCell) return

    const record = absensiData.find((a) => a.id === editingCell.recordId)
    if (!record) return

    try {
      const response = await fetch(`/api/admin/absensi/${editingCell.recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [editingCell.field]: editValue }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui data')
      }

      setAbsensiData((prev) =>
        prev.map((a) =>
          a.id === editingCell.recordId ? { ...a, [editingCell.field]: editValue } : a
        )
      )
      setEditingCell(null)
      setMessage({ type: 'success', text: 'Data berhasil diperbarui' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    }
  }

  const periodMonth = selectedPeriod ? selectedPeriod.start.getMonth() + 1 : 0
  const periodYear = selectedPeriod ? selectedPeriod.start.getFullYear() : 0

  return (
    <div className="flex flex-col gap-5">
      {message ? (
        <FeedbackBanner tone={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </FeedbackBanner>
      ) : null}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Record"
          value={
            loading ? <Skeleton className="h-8 w-14" /> : summary.total.toLocaleString('id-ID')
          }
          hint="Setelah filter diterapkan"
          icon={<Camera className="size-5" />}
          tone="info"
        />
        <StatCard
          label="Guru Tercatat"
          value={loading ? <Skeleton className="h-8 w-14" /> : summary.teachers.toLocaleString('id-ID')}
          hint={`dari ${teachers.length} guru terdaftar`}
          icon={<MapPin className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Record Berfoto"
          value={loading ? <Skeleton className="h-8 w-14" /> : summary.withPhoto.toLocaleString('id-ID')}
          hint={`${summary.photoRatio}% dari total record`}
          icon={<Camera className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Tanpa Lokasi"
          value={
            loading ? <Skeleton className="h-8 w-14" /> : summary.withoutLocation.toLocaleString('id-ID')
          }
          hint="Perlu ditelusuri kembali"
          icon={<TriangleAlert className="size-5" />}
          tone={summary.withoutLocation > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Filter Data</CardTitle>
            <CardDescription>
              Filter berlaku untuk rekap bulanan, tabel detail, dan seluruh angka di atas.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field id="yearFilter" label="Tahun">
              {(field) => (
                <Select
                  {...field}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                >
                  <option value="all">Semua Tahun</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              )}
            </Field>

            <Field id="monthFilter" label="Bulan">
              {(field) => (
                <Select
                  {...field}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                >
                  <option value="all">Semua Bulan</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
                  ))}
                </Select>
              )}
            </Field>

            <Field id="typeFilter" label="Tipe Data" hint="Hanya tampilkan record yang punya kolom tersebut.">
              {(field) => (
                <Select
                  {...field}
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value as typeof dataType)}
                >
                  <option value="all">Semua</option>
                  <option value="time">Waktu</option>
                  <option value="location">Lokasi</option>
                  <option value="image">Foto</option>
                </Select>
              )}
            </Field>

            <Field id="searchFilter" label="Cari" hint="Cocokkan sebagian pada nama, lokasi, atau alamat.">
              {(field) => (
                <Input
                  {...field}
                  type="text"
                  placeholder="Cari nama/lokasi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              )}
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Destructive actions */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Hapus Berdasarkan Periode</CardTitle>
              <CardDescription>
                Menghapus seluruh absensi pada bulan berjalan (21st - 20th).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Field id="periodDate" label="Periode (21st - 20th)" className="flex-1">
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={selectedPeriod ? selectedPeriod.start.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const d = new Date(e.target.value)
                      setSelectedPeriod({ start: d, end: d })
                    }
                  }}
                />
              )}
            </Field>
            <Button
              variant="danger"
              onClick={() => {
                // Preserved guard: without a date there is nothing to delete.
                if (!selectedPeriod) {
                  setMessage({ type: 'error', text: 'Pilih periode terlebih dahulu' })
                  return
                }
                setPendingDeletePeriod(true)
              }}
            >
              Hapus Periode
            </Button>
          </CardContent>
        </Card>

        <Card className="border-danger-border">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle className="text-danger-text">Hapus Semua Absensi</CardTitle>
              <CardDescription>
                Menghapus seluruh record absensi yang sedang tampil, termasuk file foto bila dicentang.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-text-tertiary">
              {filteredData.length.toLocaleString('id-ID')} record ikut terhapus.
            </p>
            <Button variant="danger" onClick={() => setPendingDeleteAll(true)}>
              Hapus Semua
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Monthly grid */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Rekap Per Guru</CardTitle>
            <CardDescription>
              Satu kotak = satu hari. Warna menandai kelengkapan data, dan setiap kotak punya
              keterangan teks.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-text-tertiary">
            {CELL_STATES.map((state) => (
              <li key={state.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn('size-3 rounded-xs border', CELL_LOOKUP[state.key])}
                />
                {state.label}
              </li>
            ))}
          </ul>

          <TableScroll label="Rekap absensi per guru" maxHeight="26rem">
            {loading ? (
              // Same rhythm as the real grid, so nothing shifts when data lands.
              <div className="flex flex-col gap-1">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div
                className="grid gap-1 text-center"
                style={{
                  gridTemplateColumns: 'minmax(9rem, 12rem) repeat(31, minmax(0, 2.25rem))',
                }}
              >
                {/* Header */}
                <div className="sticky left-0 z-20 rounded-sm bg-surface-sunken px-2 py-2 text-left eyebrow">
                  Guru / Tanggal
                </div>
                {Array.from({ length: 31 }, (_, i) => (
                  <div key={i} className="eyebrow flex items-center justify-center py-2">
                    {i + 1}
                  </div>
                ))}

                {teachers.map((teacher) => {
                  const teacherRecords = filteredData.filter((a) => a.user_id === teacher.id)
                  const recordMap = new Map<number, AbsensiRecord>()

                  for (const record of teacherRecords) {
                    const date = new Date(record.waktu)
                    const day = date.getDate()
                    recordMap.set(day, record)
                  }

                  return (
                    <Fragment key={teacher.id}>
                      <div className="sticky left-0 z-10 flex items-center truncate rounded-sm bg-surface-sunken px-2 py-1.5 text-left text-[13px] font-medium text-text-primary">
                        {teacher.name}
                      </div>
                      {Array.from({ length: 31 }, (_, i) => {
                        const day = i + 1
                        const record = recordMap.get(day)
                        const state = resolveState(record)
                        const description = record
                          ? `${record.nama} — ${new Date(record.waktu).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                            })} — ${record.lokasi}`
                          : `${teacher.name} tidak absen pada tanggal ${day}`

                        return (
                          <div
                            key={day}
                            title={description}
                            className={cn(
                              'flex h-8 items-center justify-center rounded-xs border',
                              CELL_LOOKUP[state]
                            )}
                          >
                            {record ? (
                              <button
                                type="button"
                                onClick={() => setPendingDelete(record)}
                                aria-label={`Hapus absensi ${record.nama} tanggal ${day}`}
                                title="Hapus"
                                className="focus-ring flex size-8 items-center justify-center rounded-xs text-danger-text transition-colors duration-150 ease-out hover:bg-danger-bg"
                              >
                                <Trash2 aria-hidden className="size-3.5" />
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </div>
            )}
          </TableScroll>

          {!loading && teachers.length === 0 ? (
            <EmptyState
              title="Belum ada data guru."
              description="Daftar guru diambil dari akun dengan role guru pada halaman Guru."
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Detail Absensi ({filteredData.length} record)</CardTitle>
            <CardDescription>
              Klik waktu atau lokasi untuk menyunting secara langsung.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <TableScroll label="Detail absensi">
            <Table className="min-w-[900px]">
              <TableCaption>Detail record absensi guru</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-surface-sunken">
                  <TableHead>Guru</TableHead>
                  <TableHead>Nilai</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead className="w-16 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`} className="hover:bg-surface-sunken">
                      <TableCell colSpan={7}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredData.length === 0 ? (
                  <TableRow className="hover:bg-surface-hover">
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        title="Tidak ada data absensi."
                        description="Coba ubah filter tahun, bulan, atau kata kunci pencarian."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((record) => {
                    const sia = record.value ? SIA_LABELS[record.value.toUpperCase()] : undefined

                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-semibold text-text-primary">
                          {record.nama}
                        </TableCell>
                        <TableCell>
                          {sia ? (
                            <Badge variant={sia.variant} title={sia.word}>
                              {record.value?.toUpperCase()}
                              <span className="sr-only"> — {sia.word}</span>
                            </Badge>
                          ) : (
                            <span className="text-text-disabled">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.recordId === record.id && editingCell?.field === 'waktu' ? (
                            <Input
                              type="datetime-local"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlineEdit()
                                if (e.key === 'Escape') setEditingCell(null)
                              }}
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startInlineEdit(record, 'waktu')}
                              className="focus-ring rounded-sm text-left transition-colors duration-150 ease-out hover:text-accent-text"
                            >
                              {new Date(record.waktu).toLocaleString('id-ID')}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.recordId === record.id && editingCell?.field === 'lokasi' ? (
                            <Input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlineEdit()
                                if (e.key === 'Escape') setEditingCell(null)
                              }}
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startInlineEdit(record, 'lokasi')}
                              className="focus-ring rounded-sm text-left transition-colors duration-150 ease-out hover:text-accent-text"
                            >
                              {record.lokasi}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>{record.alamat || '-'}</TableCell>
                        <TableCell>
                          <PhotoCell foto={record.foto} name={record.nama} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(record)}
                            aria-label={`Hapus absensi ${record.nama}`}
                            className="text-danger-text hover:bg-danger-bg hover:text-danger-text"
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableScroll>
        </CardContent>
      </Card>

      {/* Single record */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        size="sm"
        title="Hapus record absensi"
        description="Tindakan ini tidak dapat dibatalkan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => pendingDelete && handleDeleteRecord(pendingDelete.id)}
            >
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Apakah Anda yakin ingin menghapus record absensi ini?
        </p>
        {pendingDelete ? (
          <p className="meta mt-2">
            {pendingDelete.nama} — {new Date(pendingDelete.waktu).toLocaleString('id-ID')}
          </p>
        ) : null}
      </Dialog>

      {/* Period */}
      <Dialog
        open={pendingDeletePeriod}
        onOpenChange={(open) => !open && setPendingDeletePeriod(false)}
        size="sm"
        title="Hapus absensi periode"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDeletePeriod(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDeleteByPeriod}>
              Hapus Periode
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Apakah Anda yakin ingin menghapus absensi periode {MONTH_NAMES[periodMonth - 1]}{' '}
          {periodYear}?
        </p>
        <ImageCheckbox checked={deleteImages} onChange={setDeleteImages} />
      </Dialog>

      {/* Everything */}
      <Dialog
        open={pendingDeleteAll}
        onOpenChange={(open) => !open && setPendingDeleteAll(false)}
        size="sm"
        title="Hapus semua absensi"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDeleteAll(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDeleteAll}>
              Hapus Semua
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Apakah Anda yakin ingin menghapus SEMUA data absensi? Tindakan ini tidak dapat dibatalkan.
        </p>
        <ImageCheckbox checked={deleteImages} onChange={setDeleteImages} />
      </Dialog>
    </div>
  )
}

/** Replaces the second `confirm('Hapus juga foto yang tersimpan?')` step. */
function ImageCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-md border border-border-default bg-surface-sunken px-3 py-2.5 text-sm text-text-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="focus-ring size-4 accent-accent"
      />
      Hapus juga foto yang tersimpan?
    </label>
  )
}

/**
 * Attendance photo cell. A missing file renders a static placeholder in the
 * same visual language as `EmptyState`, and a broken URL falls back to it on
 * `error` instead of leaving the browser's broken-image glyph behind.
 */
function PhotoCell({ foto, name }: { foto?: string | null; name: string }) {
  // Storing which URL failed (rather than a boolean) means a new URL is
  // automatically considered healthy again — no reset effect needed.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const broken = !!foto && brokenUrl === foto

  const placeholder = (
    <span
      className="flex size-12 items-center justify-center rounded-md border border-dashed border-border-default bg-surface-sunken text-text-disabled"
      role="img"
      aria-label={`Foto absensi ${name} tidak tersedia`}
    >
      <CameraOff aria-hidden className="size-5" />
    </span>
  )

  if (!foto || broken) return placeholder

  return (
    <a
      href={foto}
      target="_blank"
      rel="noopener noreferrer"
      title={`Buka foto absensi ${name} di tab baru`}
      className="focus-ring inline-flex rounded-md border border-border-subtle bg-surface-sunken p-1 transition-colors duration-150 ease-out hover:border-border-strong"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the storage URL is
          a runtime value, so next/image cannot be used here */}
      <img
        src={foto}
        alt={`Foto absensi ${name}`}
        loading="lazy"
        onError={() => setBrokenUrl(foto)}
        className="size-10 rounded-sm object-cover"
      />
    </a>
  )
}
