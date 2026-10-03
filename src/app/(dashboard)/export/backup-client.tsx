'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarX2,
  CheckCircle2,
  Download,
  FileArchive,
  FileSpreadsheet,
  ImageIcon,
  Info,
  Loader2,
  MapPin,
  Save,
  ShieldAlert,
  Trash2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
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
import { Input, Label, Select } from '@/components/ui/input'
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

type AttendanceRecord = {
  id: number
  user_id: string
  nama: string
  lokasi: string
  alamat: string | null
  waktu: string
  akurasi: string | null
  foto: string | null
  value?: string
}

type BackupClientProps = {
  teachers: Teacher[]
  days: string[]
  attendanceMap: Map<string, Map<string, AttendanceRecord>>
  period: string
  year: string
  dataType: string
}

type CellValue = string

type Toast = {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  text: string
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Auto-dismiss delay for the local toast queue (unchanged). */
const TOAST_TTL_MS = 3000
/** How long an export button stays in its "preparing download" state. */
const EXPORT_PENDING_MS = 6000

const TOAST_TONES = {
  success: { wrapper: 'border-success-border bg-success-bg text-success-text', Icon: CheckCircle2, role: 'status' },
  error: { wrapper: 'border-danger-border bg-danger-bg text-danger-text', Icon: XCircle, role: 'alert' },
  warning: { wrapper: 'border-warning-border bg-warning-bg text-warning-text', Icon: AlertTriangle, role: 'status' },
  info: { wrapper: 'border-info-border bg-info-bg text-info-text', Icon: Info, role: 'status' },
} as const

/* ------------------------------------------------------------------ *
 * Export targets
 * ------------------------------------------------------------------ */

type ExportTarget = {
  key: string
  title: string
  format: string
  icon: LucideIcon
  href: string
  scope: string
  tone: 'success' | 'info' | 'accent'
}

/**
 * The three download targets, presented as cards that state *what* is exported,
 * *which period* it covers and *which format* comes out.
 *
 * The URLs are byte-for-byte what the three `<a>` tags used before; the only
 * difference is that the click now goes through a real `<button>` so it can own
 * a pending state and refuse a second click. The anchor it creates is same-origin
 * and every route answers with `Content-Disposition: attachment`, so the browser
 * downloads the file without ever navigating away.
 */
export function ExportTargets({
  period,
  year,
  periodLabel,
}: {
  period: string
  year: string
  periodLabel: string
}) {
  const [pending, setPending] = useState<string | null>(null)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const targets: ExportTarget[] = [
    {
      key: 'waktu',
      title: 'Rekap Jam Kehadiran',
      format: 'CSV',
      icon: FileSpreadsheet,
      href: `/api/export/export-waktu?period=${period}&year=${year}`,
      scope: `${periodLabel} · ${year}`,
      tone: 'success',
    },
    {
      key: 'lokasi',
      title: 'Rekap Lokasi GPS',
      format: 'CSV',
      icon: MapPin,
      href: `/api/export/export-lokasi?year=${year}`,
      scope: `Seluruh tahun ${year}`,
      tone: 'info',
    },
    {
      key: 'gambar',
      title: 'Arsip Foto Absensi',
      format: 'ZIP',
      icon: FileArchive,
      href: '/api/export?type=zip',
      scope: 'Seluruh foto yang tersimpan',
      tone: 'accent',
    },
  ]

  function handleExport(target: ExportTarget) {
    // One export at a time: a slow connection must not queue three archives.
    if (pending) return

    const anchor = document.createElement('a')
    anchor.href = target.href
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    setPending(target.key)
    timersRef.current.set(
      target.key,
      setTimeout(() => {
        timersRef.current.delete(target.key)
        setPending((current) => (current === target.key ? null : current))
      }, EXPORT_PENDING_MS)
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Unduh arsip</CardTitle>
          <CardDescription>
            Setiap tombol menghasilkan satu berkas. Unduhan berjalan di latar belakang — Anda
            tetap bisa menyunting grid di bawah.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <p role="status" className="sr-only">
          {pending ? 'Menyiapkan berkas unduhan…' : ''}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {targets.map((target) => {
            const busy = pending === target.key
            const Icon = target.icon

            return (
              <div
                key={target.key}
                className={cn(
                  'flex min-w-0 flex-col gap-3 rounded-md border bg-surface-card p-4 shadow-xs',
                  'transition-[border-color,box-shadow] duration-150 ease-out',
                  busy
                    ? 'border-accent-border shadow-sm'
                    : 'border-border-subtle hover:border-border-strong hover:shadow-sm'
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-md',
                      target.tone === 'success' && 'bg-success-bg text-success-text',
                      target.tone === 'info' && 'bg-info-bg text-info-text',
                      target.tone === 'accent' && 'bg-accent-subtle text-accent-text'
                    )}
                  >
                    <Icon className="size-5" />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-sm font-semibold text-text-primary">{target.title}</p>
                    <p className="text-[13px] leading-relaxed text-text-tertiary">{target.scope}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Badge variant={target.tone}>{target.format}</Badge>

                  <Button
                    size="sm"
                    onClick={() => handleExport(target)}
                    loading={busy}
                    loadingText="Mengunduh…"
                    disabled={pending !== null && !busy}
                    aria-label={`Unduh ${target.title} (${target.format})`}
                    className="flex-1 sm:flex-none"
                  >
                    <Download aria-hidden className="size-4" />
                    Unduh
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Grid seeding
 * ------------------------------------------------------------------ */

function buildGrid(
  teachers: Teacher[],
  days: string[],
  attendanceMap: Map<string, Map<string, AttendanceRecord>>
): Record<string, Record<string, CellValue>> {
  const initial: Record<string, Record<string, CellValue>> = {}

  for (const teacher of teachers) {
    initial[teacher.id] = {}
    for (const day of days) {
      const dayRecord = attendanceMap.get(teacher.id)?.get(day)
      const waktu = dayRecord?.waktu || ''
      initial[teacher.id][day] = waktu
        ? new Date(waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : ''
    }
  }

  return initial
}

/* ------------------------------------------------------------------ *
 * Client
 * ------------------------------------------------------------------ */

export default function BackupClient({
  teachers,
  days,
  attendanceMap,
  period,
  year,
  dataType,
}: BackupClientProps) {
  /**
   * The grid is seeded from the server props. This used to be a `useEffect` that
   * called `setGridData`, which is both a React lint error and an extra render.
   * Deriving the seed with `useMemo` and resetting during render is the
   * supported pattern and keeps the exact same behaviour: any change to
   * `teachers` / `days` / `attendanceMap` re-seeds the grid and drops edits.
   */
  const seededGrid = useMemo(
    () => buildGrid(teachers, days, attendanceMap),
    [teachers, days, attendanceMap]
  )
  const [gridData, setGridData] = useState(seededGrid)
  const [previousSeed, setPreviousSeed] = useState(seededGrid)

  if (previousSeed !== seededGrid) {
    setPreviousSeed(seededGrid)
    setGridData(seededGrid)
  }

  const [saving, setSaving] = useState(false)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [autoSave, setAutoSave] = useState(false)
  const [sortAsc, setSortAsc] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [deleteLock, setDeleteLock] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeletePeriodModal, setShowDeletePeriodModal] = useState(false)
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [deleteType, setDeleteType] = useState<'all' | 'data' | null>(null)
  const [deletePeriodMonth, setDeletePeriodMonth] = useState('')
  const [deletePeriodYear, setDeletePeriodYear] = useState('')
  const [deleteWithImage, setDeleteWithImage] = useState(false)

  // In-flight state. One flag per async action so nothing can be double-fired:
  // `saving` (save all), `pendingCells` (per-cell auto-save), `deletingAll`
  // and `deletingPeriod` (the two destructive routes).
  const [pendingCells, setPendingCells] = useState<Set<string>>(() => new Set())
  const [deletingAll, setDeletingAll] = useState(false)
  const [deletingPeriod, setDeletingPeriod] = useState(false)

  const toastIdRef = useRef(0)
  const toastTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timers = toastTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const addToast = useCallback((type: Toast['type'], text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    toastTimersRef.current.set(
      id,
      setTimeout(() => {
        toastTimersRef.current.delete(id)
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, TOAST_TTL_MS)
    )
  }, [])

  const markUnsaved = useCallback(() => {
    setHasUnsavedChanges(true)
  }, [])

  const clearUnsaved = useCallback(() => {
    setHasUnsavedChanges(false)
  }, [])

  const setCellPending = useCallback((key: string, pending: boolean) => {
    setPendingCells((prev) => {
      if (prev.has(key) === pending) return prev
      const next = new Set(prev)
      if (pending) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const getCellKey = useCallback((teacherId: string, day: string) => {
    return `${teacherId}-${day}`
  }, [])

  const updateCell = useCallback((teacherId: string, day: string, value: CellValue) => {
    setGridData((prev) => {
      const newGrid = { ...prev }
      if (!newGrid[teacherId]) {
        newGrid[teacherId] = {}
      }
      newGrid[teacherId] = { ...newGrid[teacherId], [day]: value }
      return newGrid
    })
  }, [])

  /**
   * One cell against `POST /api/export/backup-save`. Declared before its
   * callers so there is no use-before-declaration, and guarded by a per-cell
   * pending flag so an auto-save can never fire twice for the same cell.
   */
  const saveCell = useCallback(
    async (teacherId: string, day: string, value: string): Promise<boolean> => {
      const cellKey = getCellKey(teacherId, day)
      setCellPending(cellKey, true)

      try {
        const response = await fetch('/api/export/backup-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            period,
            year,
            data: [{ user_id: teacherId, date: day, value }],
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Gagal menyimpan')
        addToast('success', 'Data berhasil disimpan')
        clearUnsaved()
        return true
      } catch (err) {
        addToast('error', err instanceof Error ? err.message : 'Gagal menyimpan')
        return false
      } finally {
        setCellPending(cellKey, false)
      }
    },
    [period, year, addToast, clearUnsaved, getCellKey, setCellPending]
  )

  // Warn before leaving
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  const handleCellClick = useCallback(
    (teacherId: string, day: string, currentValue: CellValue) => {
      setEditingCell(getCellKey(teacherId, day))
    },
    [getCellKey]
  )

  const handleCellBlur = useCallback(
    async (teacherId: string, day: string, value: string) => {
      setEditingCell(null)
      const trimmed = value.trim()
      updateCell(teacherId, day, trimmed)
      markUnsaved()

      if (autoSave && trimmed) {
        await saveCell(teacherId, day, trimmed)
      }
    },
    [autoSave, updateCell, markUnsaved, saveCell]
  )

  const handleSaveAll = useCallback(async () => {
    if (saving) return
    setSaving(true)

    try {
      const data = []
      for (const teacher of teachers) {
        for (const day of days) {
          const value = gridData[teacher.id]?.[day]
          if (value) {
            data.push({ user_id: teacher.id, date: day, value })
          }
        }
      }

      const response = await fetch('/api/export/backup-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, year, data }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Gagal menyimpan data')
      addToast('success', 'Semua data berhasil disimpan!')
      clearUnsaved()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }, [saving, teachers, days, gridData, period, year, addToast, clearUnsaved])

  const handleSort = useCallback(() => {
    setSortAsc((prev) => !prev)
    addToast('info', `Data diurutkan ${sortAsc ? 'Z-A' : 'A-Z'}`)
  }, [sortAsc, addToast])

  const generateCaptcha = useCallback(() => {
    const code = Math.floor(10000 + Math.random() * 90000).toString()
    setCaptchaCode(code)
    setCaptchaInput('')
    return code
  }, [])

  const handleDeleteAll = useCallback(async () => {
    if (deletingAll) return

    if (captchaInput !== captchaCode) {
      setDeleteLock(true)
      addToast('error', 'Kode CAPTCHA salah! Tunggu 5 menit.')
      setTimeout(() => setDeleteLock(false), 300000)
      setShowDeleteModal(false)
      return
    }

    setDeletingAll(true)
    try {
      const response = await fetch('/api/export/delete-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ with_image: deleteType === 'all' ? 1 : 0 }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Gagal menghapus')
      addToast('success', 'Data berhasil dihapus')
      setShowDeleteModal(false)
      setDeleteType(null)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setDeletingAll(false)
    }
  }, [captchaInput, captchaCode, deleteType, deletingAll, addToast])

  const handleDeleteByPeriod = useCallback(async () => {
    if (deletingPeriod) return

    if (!deletePeriodMonth || !deletePeriodYear) {
      addToast('error', 'Pilih bulan dan tahun')
      return
    }

    setDeletingPeriod(true)
    try {
      const response = await fetch('/api/export/delete-by-period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: deletePeriodMonth,
          year: deletePeriodYear,
          with_image: deleteWithImage ? 1 : 0,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Gagal menghapus')
      addToast('success', 'Data periode berhasil dihapus')
      setShowDeletePeriodModal(false)
      setDeletePeriodMonth('')
      setDeletePeriodYear('')
      setDeleteWithImage(false)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setDeletingPeriod(false)
    }
  }, [deletePeriodMonth, deletePeriodYear, deleteWithImage, deletingPeriod, addToast])

  const busy = saving || deletingAll || deletingPeriod

  const toastStrip = (
    <div className="pointer-events-none fixed inset-x-4 top-20 z-9999 flex flex-col items-stretch gap-2 sm:left-auto sm:w-88">
      {toasts.map((toast) => {
        const tone = TOAST_TONES[toast.type]
        const Icon = tone.Icon
        return (
          <div
            key={toast.id}
            role={tone.role}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-md border px-3 py-2.5 shadow-md',
              'text-[13px] font-medium',
              tone.wrapper
            )}
          >
            <Icon aria-hidden className="mt-px size-4 shrink-0" />
            <p className="min-w-0 flex-1 leading-relaxed">{toast.text}</p>
          </div>
        )
      })}
    </div>
  )

  const emptyTeachers =
    teachers.length === 0 ? (
      <EmptyState
        title="Tidak ada guru"
        description="Tidak ada akun guru yang cocok dengan filter pencarian."
      />
    ) : null

  /* ---------------------------- Waktu ---------------------------- */
  if (dataType === 'waktu') {
    return (
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Rekap kehadiran harian</CardTitle>
            <CardDescription>
              Klik sel untuk mengubah jam masuk. Kolom <span className="font-semibold text-text-primary">TOT</span>{' '}
              menghitung hari dengan jam sebelum pukul 07:00.
            </CardDescription>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button
              onClick={handleSaveAll}
              loading={saving}
              loadingText="Menyimpan..."
              disabled={busy && !saving}
            >
              <Save aria-hidden className="size-4" />
              Scan &amp; Simpan Perubahan
            </Button>

            <button
              type="button"
              role="switch"
              aria-checked={autoSave}
              onClick={() => setAutoSave((prev) => !prev)}
              disabled={busy}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-[13px] font-semibold',
                'transition-[background-color,border-color,color] duration-150 ease-out',
                'disabled:pointer-events-none disabled:opacity-55',
                autoSave
                  ? 'border-accent-border bg-accent-subtle text-accent-subtle-text'
                  : 'border-border-default bg-surface-card text-text-secondary hover:border-border-strong hover:bg-surface-hover'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-150 ease-out',
                  autoSave ? 'bg-accent' : 'bg-border-strong'
                )}
              >
                <span
                  className={cn(
                    'absolute size-3 rounded-full bg-surface-card transition-transform duration-150 ease-out',
                    autoSave ? 'translate-x-[15px]' : 'translate-x-[3px]'
                  )}
                />
              </span>
              Auto Save
            </button>

            <Button variant="secondary" onClick={handleSort} disabled={busy}>
              <ArrowUpDown aria-hidden className="size-4" />
              {sortAsc ? 'A-Z' : 'Z-A'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {toastStrip}

          {busy ? (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-md border border-accent-border bg-accent-subtle px-3 py-2.5 text-[13px] font-medium text-accent-subtle-text"
            >
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {saving
                ? 'Menyimpan seluruh perubahan…'
                : deletingAll || deletingPeriod
                  ? 'Menghapus data, jangan tutup halaman…'
                  : 'Memproses…'}
            </div>
          ) : null}

          {emptyTeachers ? (
            emptyTeachers
          ) : (
            <TableScroll maxHeight="34rem" label="Rekap kehadiran harian">
              <Table
                style={{
                  tableLayout: 'fixed',
                  minWidth: `${430 + days.length * 72}px`,
                }}
              >
                <TableCaption>
                  Rekap jam kehadiran {teachers.length} guru untuk periode {period} tahun {year}
                </TableCaption>

                <TableHeader>
                  <TableRow className="hover:bg-surface-sunken">
                    <TableHead className="sticky left-0 z-20 w-[50px]">No</TableHead>
                    <TableHead className="sticky left-[50px] z-20 w-[220px]">Nama</TableHead>
                    {days.map((day) => (
                      <TableHead key={day} className="w-[72px] text-center">
                        {new Date(day).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </TableHead>
                    ))}
                    <TableHead className="sticky right-0 z-20 w-[80px] text-center">TOT</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {teachers.map((teacher, idx) => {
                    const teacherData = gridData[teacher.id] || {}
                    let tot = 0
                    for (const day of days) {
                      const val = teacherData[day]
                      if (val && val !== '') {
                        const [h, m] = val.split(':').map(Number)
                        if (!isNaN(h) && !isNaN(m) && h < 7) tot++
                      }
                    }

                    return (
                      <TableRow key={teacher.id}>
                        <TableCell className="sticky left-0 z-10 w-[50px] bg-surface-card text-text-tertiary">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="sticky left-[50px] z-10 w-[220px] bg-surface-card font-medium text-text-primary">
                          {teacher.name}
                        </TableCell>

                        {days.map((day) => {
                          const value = teacherData[day] || ''
                          const cellKey = getCellKey(teacher.id, day)
                          const isEditing = editingCell === cellKey
                          const cellPending = pendingCells.has(cellKey)

                          return (
                            <TableCell
                              key={day}
                              className={cn(
                                'p-0 text-center',
                                isEditing && 'bg-accent-subtle'
                              )}
                            >
                              {isEditing ? (
                                <Input
                                  type="time"
                                  autoFocus
                                  defaultValue={value}
                                  onBlur={(e) => handleCellBlur(teacher.id, day, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      ;(e.target as HTMLInputElement).blur()
                                    }
                                  }}
                                  aria-label={`Jam masuk ${teacher.name} pada ${day}`}
                                  className="h-7 rounded-sm border-accent-border bg-surface-card px-1 text-center text-[13px]"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCellClick(teacher.id, day, value)}
                                  disabled={busy || cellPending}
                                  aria-label={`Ubah jam masuk ${teacher.name} pada ${day}, saat ini ${
                                    value || 'kosong'
                                  }`}
                                  className={cn(
                                    'flex h-9 w-full items-center justify-center gap-1 px-1',
                                    'text-[13px] tabular-nums text-text-secondary',
                                    'transition-colors duration-150 ease-out',
                                    'hover:bg-surface-hover hover:text-text-primary',
                                    'disabled:pointer-events-none disabled:opacity-55',
                                    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent'
                                  )}
                                >
                                  {cellPending ? (
                                    <Loader2
                                      aria-hidden
                                      className="size-3.5 animate-spin text-accent-text"
                                    />
                                  ) : null}
                                  {value || '-'}
                                </button>
                              )}
                            </TableCell>
                          )
                        })}

                        <TableCell className="sticky right-0 z-10 w-[80px] bg-surface-card text-center font-bold text-text-primary">
                          {tot}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableScroll>
          )}

          <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            <p className="flex items-center gap-2 text-[13px] font-medium text-text-tertiary">
              <ShieldAlert aria-hidden className="size-4 shrink-0 text-danger-text" />
              Tindakan berikut menghapus data secara permanen.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                onClick={() => {
                  generateCaptcha()
                  setShowDeleteModal(true)
                }}
                disabled={deleteLock || busy}
              >
                <Trash2 aria-hidden className="size-4" />
                Hapus Semua Absensi
              </Button>

              <Button
                variant="secondary"
                onClick={() => setShowDeletePeriodModal(true)}
                disabled={deleteLock || busy}
              >
                <CalendarX2 aria-hidden className="size-4" />
                Hapus per Bulan
              </Button>

              {deleteLock ? (
                <span className="text-[13px] font-medium text-danger-text">
                  Terkunci selama 5 menit karena kode CAPTCHA salah.
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>

        {/* Delete all — CAPTCHA gate */}
        <Dialog
          open={showDeleteModal}
          onOpenChange={(open) => !open && !deletingAll && setShowDeleteModal(false)}
          size="sm"
          title="Verifikasi CAPTCHA"
          description="Ketik kode di bawah untuk mengonfirmasi penghapusan seluruh data absensi."
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingAll}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteAll}
                loading={deletingAll}
                loadingText="Menghapus..."
              >
                Verifikasi
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center rounded-md border border-info-border bg-info-bg px-4 py-4">
              <span className="font-mono text-3xl font-bold tracking-[0.3em] text-info-text">
                {captchaCode}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="captchaInput">Kode CAPTCHA</Label>
              <Input
                id="captchaInput"
                name="captcha"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="Ketik kode di atas"
                className="text-center font-mono tracking-[0.2em]"
              />
            </div>

            <p className="text-[13px] text-text-tertiary">
              Kode yang salah akan mengunci tindakan hapus selama 5 menit.
            </p>
          </div>
        </Dialog>

        {/* Delete by period */}
        <Dialog
          open={showDeletePeriodModal}
          onOpenChange={(open) => !open && !deletingPeriod && setShowDeletePeriodModal(false)}
          size="sm"
          title="Hapus Data per Bulan"
          description="Pilih bulan dan tahun yang datanya akan dihapus permanen."
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowDeletePeriodModal(false)}
                disabled={deletingPeriod}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteByPeriod}
                loading={deletingPeriod}
                loadingText="Menghapus..."
              >
                Hapus Data
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deletePeriodMonth">Bulan</Label>
              <Select
                id="deletePeriodMonth"
                name="deletePeriodMonth"
                value={deletePeriodMonth}
                onChange={(e) => setDeletePeriodMonth(e.target.value)}
              >
                <option value="">Pilih Bulan</option>
                {MONTH_NAMES.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deletePeriodYear">Tahun</Label>
              <Input
                id="deletePeriodYear"
                name="deletePeriodYear"
                type="number"
                value={deletePeriodYear}
                onChange={(e) => setDeletePeriodYear(e.target.value)}
                placeholder="2026"
              />
            </div>

            <label
              htmlFor="deleteWithImage"
              className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border-subtle bg-surface-sunken px-3 py-2.5"
            >
              <input
                id="deleteWithImage"
                name="deleteWithImage"
                type="checkbox"
                checked={deleteWithImage}
                onChange={(e) => setDeleteWithImage(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-text-primary">
                  Ikut hapus file gambar fisik?
                </span>
                <span className="text-[13px] text-text-tertiary">
                  Menghapus berkas pada bucket storage, bukan hanya baris database.
                </span>
              </span>
            </label>
          </div>
        </Dialog>
      </Card>
    )
  }

  /* ---------------------------- Lokasi ---------------------------- */
  if (dataType === 'lokasi') {
    return (
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Rekap lokasi GPS</CardTitle>
            <CardDescription>
              Koordinat, alamat, waktu, dan akurasi dari satu catatan per guru.
            </CardDescription>
          </div>
          <Badge variant="info">
            <MapPin aria-hidden className="size-3.5" />
            Lokasi
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {toastStrip}

          {emptyTeachers ?? (
            <TableScroll label="Rekap lokasi GPS">
              <Table className="min-w-[720px]">
                <TableCaption>
                  Rekap lokasi GPS {teachers.length} guru untuk periode {period} tahun {year}
                </TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-surface-sunken">
                    <TableHead>Nama</TableHead>
                    <TableHead>Lokasi (GPS)</TableHead>
                    <TableHead>Alamat</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Akurasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => {
                    const teacherRecords = attendanceMap.get(teacher.id)
                    const records = teacherRecords ? Array.from(teacherRecords.values()) : []

                    return (
                      <TableRow key={teacher.id}>
                        <TableCell className="font-medium text-text-primary">
                          {teacher.name}
                        </TableCell>
                        <TableCell>{records[0]?.lokasi || '-'}</TableCell>
                        <TableCell>{records[0]?.alamat || '-'}</TableCell>
                        <TableCell>
                          {records[0]?.waktu
                            ? new Date(records[0].waktu).toLocaleString('id-ID')
                            : '-'}
                        </TableCell>
                        <TableCell>{records[0]?.akurasi || '-'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>
    )
  }

  /* ---------------------------- Gambar ---------------------------- */
  if (dataType === 'gambar') {
    return (
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Foto absensi</CardTitle>
            <CardDescription>Klik foto untuk membuka ukuran aslinya.</CardDescription>
          </div>
          <Badge variant="accent">
            <ImageIcon aria-hidden className="size-3.5" />
            Gambar
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {toastStrip}

          {emptyTeachers ?? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {teachers.map((teacher) => {
                const teacherRecords = attendanceMap.get(teacher.id)
                const records = teacherRecords
                  ? Array.from(teacherRecords.values()).filter((r) => r.foto)
                  : []

                return (
                  <div
                    key={teacher.id}
                    className="flex min-w-0 flex-col gap-3 rounded-md border border-border-subtle bg-surface-card p-3 shadow-xs"
                  >
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {teacher.name}
                    </p>

                    {records.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {records.map((record, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => window.open(record.foto!, '_blank')}
                            aria-label={`Buka foto ${teacher.name} pada ${record.waktu}`}
                            className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            <img
                              src={record.foto!}
                              alt={`${teacher.name} - ${record.waktu}`}
                              loading="lazy"
                              className="aspect-[4/3] w-full rounded-sm object-cover transition-transform duration-150 ease-out group-hover:scale-[1.03]"
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-default bg-surface-sunken px-3 py-6 text-center">
                        <ImageIcon aria-hidden className="size-5 text-text-disabled" />
                        <p className="text-[13px] text-text-tertiary">Tidak ada foto</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <EmptyState
          title="Tipe data tidak dikenal"
          description="Pilih tipe data pada filter di atas: Waktu, Lokasi, atau Gambar."
        />
      </CardContent>
    </Card>
  )
}