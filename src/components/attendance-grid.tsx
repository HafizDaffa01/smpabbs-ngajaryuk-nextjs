'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Label } from '@/components/ui/input'
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
import { cn } from '@/lib/utils'

type Student = {
  id: number
  name: string
  grade: string
}

type AttendanceMap = Record<string, Record<number, string>>
type SummaryMap = Record<number, { S: number; I: number; A: number }>

interface AttendanceGridProps {
  students: Student[]
  attendanceMap: AttendanceMap
  summaryMap: SummaryMap
  day: number
  month: number
  year: number
  grade: string
  onAttendanceChange: (studentId: number, day: number, value: 'S' | 'I' | 'A' | '') => void
}

/**
 * `S`/`I`/`A` and the clear option. The Indonesian label is never colour-only:
 * it rides along in the button text and in every `aria-label`, so the letter and
 * the wording carry the meaning even in monochrome.
 */
const STATUS_META = {
  S: { label: 'Sakit', variant: 'warning' },
  I: { label: 'Izin', variant: 'info' },
  A: { label: 'Alpa', variant: 'danger' },
} as const satisfies Record<string, { label: string; variant: 'warning' | 'info' | 'danger' }>

const STATUS_OPTIONS = ['S', 'I', 'A', ''] as const

const NO_COL = 80
const NAME_COL = 140
const DAY_COL = 44
const SUM_COL = 40

/**
 * Cell styling. Every utility here overrides a default from `@/components/ui/table`
 * (`TableHead`/`TableCell`), and `cn` + tailwind-merge resolves those in favour of
 * the last class, so no `!important` modifiers are needed.
 */
const HEAD_CELL = 'border border-border-subtle px-2 py-1.5'
const HEAD_CELL_LEFT = cn(HEAD_CELL, 'bg-surface-sunken text-left')
const HEAD_CELL_CENTER = cn(HEAD_CELL, 'bg-surface-sunken text-center')
const BODY_CELL = 'border border-border-subtle p-0 text-center'
const STICKY_CELL = 'sticky z-20 bg-surface-card group-hover/row:bg-surface-hover'

export default function AttendanceGrid({
  students,
  attendanceMap,
  summaryMap,
  day,
  month,
  year,
  grade,
  onAttendanceChange,
}: AttendanceGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [openCell, setOpenCell] = useState<{ studentId: number; day: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  const isToday = (d: number) => {
    return today.getDate() === d && today.getMonth() + 1 === month && today.getFullYear() === year
  }

  const isSelected = (d: number) => d === day

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = searchQuery.toLowerCase()
    return students.filter((s) => s.name.toLowerCase().includes(q))
  }, [students, searchQuery])

  const daysInMonth = new Date(year, month, 0).getDate()

  const dayColumns = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => ({
        day: d,
        label: new Date(year, month - 1, d).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      })),
    [daysInMonth, year, month]
  )

  const monthLabel = useMemo(
    () => new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    [year, month]
  )

  const tableMinWidth =
    dayColumns.length * DAY_COL + NO_COL + NAME_COL + SUM_COL * 3

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setOpenCell(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Escape closes the open cell; the arrow keys move between the four options.
  useEffect(() => {
    if (!openCell) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenCell(null)
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return

      const options = Array.from(
        gridRef.current?.querySelectorAll<HTMLButtonElement>('[data-att-option]') ?? []
      )
      if (options.length === 0) return

      e.preventDefault()
      const current = options.indexOf(document.activeElement as HTMLButtonElement)
      const next = e.key === 'ArrowDown' ? current + 1 : current - 1
      const fallback = e.key === 'ArrowDown' ? 0 : options.length - 1
      const target = current === -1 ? fallback : Math.min(Math.max(next, 0), options.length - 1)
      options[target]?.focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openCell])

  function getCellValue(studentId: number, d: number): string {
    return attendanceMap[String(studentId)]?.[d] || ''
  }

  function handleCellClick(studentId: number, d: number) {
    setOpenCell({ studentId, day: d })
  }

  function selectValue(studentId: number, d: number, value: 'S' | 'I' | 'A' | '') {
    onAttendanceChange(studentId, d, value)
    setOpenCell(null)
  }

  const isEmpty = students.length === 0
  const noMatches = !isEmpty && filteredStudents.length === 0

  return (
    <div
      ref={gridRef}
      className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-card font-sans text-sm"
    >
      {/* Filter + legend */}
      <div className="flex flex-col gap-3 border-b border-border-subtle px-3 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-64">
          <Label htmlFor="attendanceSearch">Cari nama siswa</Label>
          <div className="relative mt-1.5">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary"
            />
            <Input
              id="attendanceSearch"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari nama siswa..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Legend — the same letter + wording the cells use, never colour alone. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] text-text-tertiary">Keterangan:</span>
          {(['S', 'I', 'A'] as const).map((code) => (
            <Badge key={code} variant={STATUS_META[code].variant}>
              {code} &middot; {STATUS_META[code].label}
            </Badge>
          ))}
        </div>
      </div>

      {isEmpty || noMatches ? (
        <EmptyState
          title={
            noMatches ? 'Tidak ada siswa yang cocok.' : 'Belum ada data siswa.'
          }
          description={
            noMatches
              ? 'Tidak ada nama yang memuat kata kunci pencarian. Coba kata kunci lain atau kosongkan kolom pencarian.'
              : 'Absensi belum dapat ditampilkan karena kelas ini belum memiliki siswa.'
          }
        />
      ) : (
        <TableScroll label={`Tabel absensi kelas ${grade}`} maxHeight="34rem">
          <Table className="table-fixed" style={{ minWidth: tableMinWidth }}>
            <TableCaption>
              Absensi siswa kelas {grade}, {monthLabel}. Gunakan tombol pada setiap sel untuk
              memilih status S, I, atau A.
            </TableCaption>
            <TableHeader>
              <tr>
                <TableHead className={cn(HEAD_CELL_LEFT, 'sticky start-0 z-30 w-20')}>No</TableHead>
                <TableHead className={cn(HEAD_CELL_LEFT, 'sticky start-20 z-30 w-[140px]')}>
                  Nama Siswa
                </TableHead>
                {dayColumns.map(({ day: d, label }) => (
                  <TableHead
                    key={d}
                    className={cn(
                      HEAD_CELL,
                      'w-11',
                      isSelected(d)
                        ? 'bg-accent text-on-accent'
                        : isToday(d)
                          ? 'bg-info-bg text-info-text'
                          : 'bg-surface-sunken'
                    )}
                  >
                    {d}
                    <span className="sr-only">
                      {label}
                      {isSelected(d) ? ' — tanggal dipilih' : ''}
                      {isToday(d) ? ' — hari ini' : ''}
                    </span>
                  </TableHead>
                ))}
                <TableHead className={cn(HEAD_CELL_CENTER, 'w-10')}>
                  S<span className="sr-only"> — jumlah sakit</span>
                </TableHead>
                <TableHead className={cn(HEAD_CELL_CENTER, 'w-10')}>
                  I<span className="sr-only"> — jumlah izin</span>
                </TableHead>
                <TableHead className={cn(HEAD_CELL_CENTER, 'w-10')}>TOT</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student, idx) => {
                const summary = summaryMap[student.id] || { S: 0, I: 0, A: 0 }

                return (
                  <TableRow key={student.id} className="group/row">
                    <TableCell
                      className={cn(
                        BODY_CELL,
                        STICKY_CELL,
                        'start-0 w-20 text-text-tertiary'
                      )}
                    >
                      {idx + 1}
                    </TableCell>
                    <th
                      scope="row"
                      className={cn(
                        HEAD_CELL,
                        STICKY_CELL,
                        'start-20 w-[140px] text-left text-text-primary font-semibold whitespace-normal'
                      )}
                    >
                      {student.name}
                    </th>

                    {dayColumns.map(({ day: d, label }) => {
                      const value = getCellValue(student.id, d)
                      const isOpen = openCell?.studentId === student.id && openCell?.day === d
                      const statusLabel = STATUS_META[value as 'S' | 'I' | 'A']?.label

                      return (
                        <TableCell
                          key={d}
                          className={cn(
                            BODY_CELL,
                            'relative w-11',
                            isSelected(d) && 'bg-accent text-on-accent',
                            !isSelected(d) && isToday(d) && 'bg-info-bg text-info-text'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleCellClick(student.id, d)}
                            onKeyDown={(event) => {
                              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                event.preventDefault()
                                setOpenCell({ studentId: student.id, day: d })
                              }
                            }}
                            aria-expanded={isOpen}
                            aria-haspopup="true"
                            aria-label={`${student.name}, ${label}${isToday(d) ? ', hari ini' : ''}${
                              statusLabel ? `, status ${statusLabel}` : ', belum ada status'
                            }`}
                            className={cn(
                              'focus-ring flex h-11 w-full items-center justify-center sm:h-8',
                              'transition-colors duration-150 ease-out hover:bg-surface-hover',
                              isSelected(d) && 'font-semibold'
                            )}
                          >
                            {value ? (
                              <Badge
                                aria-hidden
                                variant={STATUS_META[value as 'S' | 'I' | 'A'].variant}
                                className="h-6 min-w-6 justify-center px-1 text-[11px] leading-none"
                              >
                                {value}
                              </Badge>
                            ) : (
                              <span
                                aria-hidden
                                className="size-1.5 rounded-full bg-current opacity-40"
                              />
                            )}
                          </button>

                          {isOpen ? (
                            <div
                              role="radiogroup"
                              aria-label={`Pilih status absensi ${student.name} pada ${label}`}
                              className="absolute top-full left-1/2 z-30 mt-1 flex w-max min-w-32 -translate-x-1/2 flex-col gap-0.5 rounded-md border border-border-default bg-surface-raised p-1 shadow-lg"
                            >
                              {STATUS_OPTIONS.map((option) => {
                                const meta =
                                  option === ''
                                    ? null
                                    : STATUS_META[option as 'S' | 'I' | 'A']
                                const isCurrent = value === option

                                return (
                                  <button
                                    key={option || 'none'}
                                    type="button"
                                    role="radio"
                                    aria-checked={isCurrent}
                                    data-att-option
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      selectValue(student.id, d, option)
                                    }}
                                    className={cn(
                                      'focus-ring flex min-h-11 items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-[13px] font-semibold sm:min-h-9',
                                      'transition-colors duration-150 ease-out',
                                      isCurrent
                                        ? 'bg-accent-subtle text-accent-subtle-text'
                                        : 'text-text-secondary hover:bg-surface-hover'
                                    )}
                                  >
                                    <span>{option || '—'}</span>
                                    <span className="text-xs font-medium">
                                      {meta ? meta.label : 'Kosong'}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          ) : null}
                        </TableCell>
                      )
                    })}

                    <TableCell className={cn(BODY_CELL, 'w-10')}>
                      <span className="font-semibold text-warning-text">{summary.S}</span>
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'w-10')}>
                      <span className="font-semibold text-info-text">{summary.I}</span>
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'w-10')}>
                      <span className="font-bold text-danger-text">
                        {summary.S + summary.I + summary.A}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableScroll>
      )}
    </div>
  )
}
