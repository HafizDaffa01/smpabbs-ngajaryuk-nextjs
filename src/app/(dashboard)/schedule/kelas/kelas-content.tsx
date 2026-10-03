'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarPlus, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Field, Select } from '@/components/ui/input'
import { SkeletonTable } from '@/components/ui/skeleton'
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
import { VALID_LESSONS_BY_DAY, type ScheduleRecord } from '@/lib/bell-schedule'

/** Row shape returned by `GET /api/schedule` (`schedules` table, `select('*')`). */
type ScheduleRow = ScheduleRecord & { id: number }

type ScheduleResponse = {
  schedules?: ScheduleRow[]
  error?: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const DAY_NAMES: Record<string, string> = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
}

/**
 * Row axis. 9 is the widest day (Monday–Thursday); Friday tops out at 9 with a
 * gap at 6, and Saturday only reaches 6.
 */
const MAX_PERIOD = 9

function formatJam(value: string): string {
  return value.slice(0, 5)
}

/**
 * Leadership rows are stored with a **bare grade digit** as `class_name`
 * (`'7'`, `'8'`, `'9'`) rather than a `7A`-style code, because a leadership
 * meeting covers the whole grade at once. Rendering that as "7" would look like
 * a broken class code, so it is relabelled.
 */
function isLeadershipClass(className: string): boolean {
  return /^\d$/.test(className)
}

function classLabel(className: string): string {
  return isLeadershipClass(className) ? `Leadership ${className}` : className
}

/** Natural order: grade, then letter — so `7A` `7B` `7` `8A`. */
function classSortKey(className: string): [number, string] {
  if (isLeadershipClass(className)) return [Number(className), '']
  const match = className.match(/^(\d)([A-Za-z]?)/)
  return match ? [Number(match[1]), match[2]] : [99, className]
}

/** `teacher` is one comma-joined string — team teaching packs several names. */
function splitTeachers(teacher: string | null): string[] {
  if (!teacher) return []
  return teacher
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

function subjectLabel(row: ScheduleRow): string {
  return row.subject_display || row.subject
}

/**
 * Client half of `/schedule/kelas`.
 *
 * Split out of `page.tsx` (which owns the auth guard, the `<Suspense>`
 * boundary and the `PageHeader`) for the same reason `schedule-browser.tsx` is
 * its own module: `TeacherShell` is an async Server Component, so the page
 * cannot be `'use client'`. `useSearchParams()` still needs the `<Suspense>`
 * the page already provides.
 *
 * Two requests, both through the existing `GET /api/schedule`: one unfiltered
 * pass to learn which classes exist (and to detect an empty database), then one
 * scoped pass for the selected class. The pivot is done here rather than
 * server-side so switching classes never re-renders the RSC shell.
 */
export default function KelasContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [classes, setClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState(searchParams.get('class') || '')
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pass 1 — which classes exist? Doubles as the empty-database probe.
  useEffect(() => {
    let cancelled = false

    async function fetchClasses() {
      setLoadingClasses(true)
      setError(null)
      try {
        const response = await fetch('/api/schedule')
        const data = (await response.json()) as ScheduleResponse
        if (!response.ok) throw new Error(data.error || 'Gagal memuat daftar kelas')

        const found = [...new Set((data.schedules || []).map((s) => String(s.class_name)))]
          .filter(Boolean)
          .sort((a, b) => {
            const [ga, la] = classSortKey(a)
            const [gb, lb] = classSortKey(b)
            return ga - gb || la.localeCompare(lb)
          })

        if (cancelled) return
        setClasses(found)
        // Default to the first class so the grid is never a dead end.
        if (!searchParams.get('class') && found.length > 0) {
          setSelectedClass(found[0])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat daftar kelas')
        }
      } finally {
        if (!cancelled) setLoadingClasses(false)
      }
    }

    fetchClasses()
    return () => {
      cancelled = true
    }
    // Intentionally mount-only: the class list only changes when data is re-imported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pass 2 — the selected class's week.
  useEffect(() => {
    if (!selectedClass) {
      return
    }

    let cancelled = false

    async function fetchGrid() {
      setLoadingGrid(true)
      setError(null)
      try {
        const response = await fetch(`/api/schedule?class=${encodeURIComponent(selectedClass)}`)
        const data = (await response.json()) as ScheduleResponse
        if (!response.ok) throw new Error(data.error || 'Gagal memuat jadwal kelas')

        if (cancelled) return
        setRows(data.schedules || [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat jadwal kelas')
        }
      } finally {
        if (!cancelled) setLoadingGrid(false)
      }
    }

    fetchGrid()
    return () => {
      cancelled = true
    }
  }, [selectedClass])

  function handleClassChange(next: string) {
    setSelectedClass(next)
    setRows([])
    // Keep the view deep-linkable and back/forward friendly.
    router.push(next ? `/schedule/kelas?class=${encodeURIComponent(next)}` : '/schedule/kelas')
  }

  /** `day -> period -> rows`. Arrays, because one slot can hold more than one row. */
  const grid = useMemo(() => {
    const map = new Map<string, Map<number, ScheduleRow[]>>()
    for (const day of DAYS) map.set(day, new Map())

    for (const row of rows) {
      if (!DAYS.includes(row.day)) continue
      const dayMap = map.get(row.day)!
      const bucket = dayMap.get(row.period)
      if (bucket) bucket.push(row)
      else dayMap.set(row.period, [row])
    }

    for (const dayMap of map.values()) {
      for (const [period, bucket] of dayMap) {
        dayMap.set(period, [...bucket].sort((a, b) => a.id - b.id))
      }
    }

    return map
  }, [rows])

  /**
   * "Mapel → Guru" summary. Teacher names are kept out of the grid cells
   * because a cell is too small to hold a subject *and* a name legibly; the
   * reference app moved them here for the same reason.
   */
  const mapelSummary = useMemo(() => {
    const bySubject = new Map<string, Set<string>>()

    for (const row of rows) {
      const subject = subjectLabel(row)
      const teachers = bySubject.get(subject) ?? new Set<string>()
      for (const name of splitTeachers(row.teacher)) teachers.add(name)
      bySubject.set(subject, teachers)
    }

    return [...bySubject.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'id'))
      .map(([subject, teachers]) => ({ subject, teachers: [...teachers].sort() }))
  }, [rows])

  const occupiedSlots = grid
    .values()
    .reduce(
      (total, dayMap) => total + [...dayMap.values()].filter((bucket) => bucket.length > 0).length,
      0
    )

  const loading = loadingClasses || loadingGrid

  return (
    <>
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Kelas</CardTitle>
            <CardDescription>
              Jadwal per kelas hasil import aSc Timetables v9.4. Tiap kolom adalah hari, tiap
              baris adalah jam pelajaran.
            </CardDescription>
          </div>
          <Badge variant="neutral">
            {loading ? 'Memuat…' : `${occupiedSlots} sesi terisi`}
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {error ? (
            <FeedbackBanner tone="error" onDismiss={() => setError(null)}>
              {error}
            </FeedbackBanner>
          ) : null}

          {loadingClasses ? (
            <SkeletonTable rows={4} cols={3} />
          ) : classes.length === 0 ? (
            <EmptyState
              title="Belum ada kelas"
              description="Tabel jadwal masih kosong. Impor berkas .xlsx dari aSc Timetables v9.4 terlebih dahulu, lalu halaman ini akan menampilkan jadwal mingguan setiap kelas."
              action={
                <ButtonLink href="/schedule/import" variant="secondary">
                  <CalendarPlus aria-hidden className="size-4" />
                  Import Jadwal
                </ButtonLink>
              }
            />
          ) : (
            <Field id="kelas" label="Kelas" className="w-full sm:w-56">
              {(field) => (
                <Select
                  {...field}
                  name="class"
                  value={selectedClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                >
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {classLabel(c)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </CardContent>
      </Card>

      {classes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Jadwal Mingguan — {classLabel(selectedClass)}</CardTitle>
              <CardDescription>
                Jam ke-6 pada Jumat dipakai untuk salat Jumat, dan hari Sabtu hanya memiliki 6 jam
                pelajaran.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {loading ? (
              <SkeletonTable rows={MAX_PERIOD} cols={DAYS.length + 1} />
            ) : occupiedSlots === 0 ? (
              <EmptyState
                title="Jadwal kelas ini belum terisi"
                description={`Belum ada jam pelajaran untuk ${classLabel(selectedClass)}. Coba pilih kelas lain, atau import ulang berkas aSc Timetables.`}
                action={
                  <ButtonLink href="/schedule/import" variant="secondary">
                    <CalendarPlus aria-hidden className="size-4" />
                    Import Jadwal
                  </ButtonLink>
                }
              />
            ) : (
              <TableScroll
                label={`Jadwal mingguan kelas ${classLabel(selectedClass)}`}
                maxHeight="68vh"
              >
                <Table className="min-w-[880px]">
                  <TableCaption>
                    Jadwal mingguan kelas {classLabel(selectedClass)}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="left-0 z-20">Jam</TableHead>
                      {DAYS.map((day) => (
                        <TableHead key={day} scope="col">
                          {DAY_NAMES[day]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: MAX_PERIOD }, (_, i) => i + 1).map((period) => (
                      <TableRow key={period}>
                        <TableHead
                          scope="row"
                          className="sticky left-0 top-auto z-10 bg-surface-card text-text-secondary"
                        >
                          Jam ke-{period}
                        </TableHead>

                        {DAYS.map((day) => {
                          const teachesToday = VALID_LESSONS_BY_DAY[day]?.includes(period) ?? false
                          const bucket = grid.get(day)?.get(period) ?? []

                          if (!teachesToday) {
                            return (
                              <TableCell
                                key={day}
                                className="bg-surface-sunken text-center text-text-disabled"
                              >
                                <span aria-hidden>—</span>
                                <span className="sr-only">Tidak ada jam pelajaran</span>
                              </TableCell>
                            )
                          }

                          if (bucket.length === 0) {
                            return (
                              <TableCell key={day} className="text-text-tertiary">
                                <span aria-hidden>-</span>
                                <span className="sr-only">Kosong</span>
                              </TableCell>
                            )
                          }

                          return (
                            <TableCell key={day} className="align-top">
                              <ul className="flex flex-col gap-1.5">
                                {bucket.map((row) => {
                                  const time =
                                    row.start_time && row.end_time
                                      ? `${formatJam(row.start_time)} - ${formatJam(row.end_time)}`
                                      : null
                                  return (
                                    <li key={row.id} className="flex flex-col gap-0.5">
                                      <span className="text-sm font-semibold text-text-primary">
                                        {subjectLabel(row)}
                                      </span>
                                      {time ? (
                                        <span className="inline-flex items-center gap-1 text-xs tabular-nums text-text-tertiary">
                                          <Clock aria-hidden className="size-3" />
                                          {time}
                                        </span>
                                      ) : null}
                                    </li>
                                  )
                                })}
                              </ul>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScroll>
            )}
          </CardContent>
        </Card>
      )}

      {mapelSummary.length > 0 && (
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Mapel &rarr; Guru</CardTitle>
              <CardDescription>
                Ringkasan guru pengampu untuk kelas {classLabel(selectedClass)}.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {mapelSummary.map(({ subject, teachers }) => (
                <li
                  key={subject}
                  className="flex items-start justify-between gap-3 rounded-sm border border-border-subtle bg-surface-raised px-3 py-2"
                >
                  <span className="text-sm font-medium text-text-primary">{subject}</span>
                  <span className="text-right text-sm text-text-secondary">
                    {teachers.length > 0 ? teachers.join(', ') : 'Tanpa guru'}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}
