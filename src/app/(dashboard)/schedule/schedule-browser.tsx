'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarPlus, Clock, Table2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
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
import type { ScheduleRecord } from '@/lib/bell-schedule'

/** Row shape returned by `GET /api/schedule` (`schedules` table, `select('*')`). */
type ScheduleRow = ScheduleRecord & { id: number }

type ScheduleResponse = {
  schedules?: ScheduleRow[]
  error?: string
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const DAY_LABELS: Record<string, string> = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
}

function formatJam(value: string): string {
  return value.slice(0, 5)
}

/**
 * Client half of `/schedule`.
 *
 * Kept as a separate module (rather than `'use client'` on the page itself) for
 * one reason: `TeacherShell` is an **async Server Component** — it reads
 * `cookies()` — and a `'use client'` module cannot import one. `page.tsx` is
 * therefore a thin RSC that renders the shell and the `<Suspense>` boundary,
 * exactly as the client page used to do.
 *
 * `useSearchParams()` still needs the `<Suspense>` boundary, and the fetch /
 * URL-sync behaviour is unchanged from the original single-file page.
 */
export default function SchedulePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedClass, setSelectedClass] = useState(searchParams.get('class') || '')
  const [selectedDay, setSelectedDay] = useState(searchParams.get('day') || 'Monday')
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [classes, setClasses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [classError, setClassError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setScheduleError(null)
      try {
        const params = new URLSearchParams()
        if (selectedClass) params.set('class', selectedClass)
        if (selectedDay) params.set('day', selectedDay)

        const response = await fetch(`/api/schedule?${params.toString()}`)
        const data = (await response.json()) as ScheduleResponse

        if (!response.ok) {
          throw new Error(data.error || 'Gagal memuat jadwal')
        }

        setSchedules(data.schedules || [])
      } catch (err) {
        console.error('Failed to fetch schedules:', err)
        setScheduleError(err instanceof Error ? err.message : 'Gagal memuat jadwal')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedClass, selectedDay])

  useEffect(() => {
    async function fetchClasses() {
      try {
        const response = await fetch('/api/schedule')
        const data = (await response.json()) as ScheduleResponse

        if (!response.ok) {
          throw new Error(data.error || 'Gagal memuat kelas')
        }

        const allClasses = [...new Set((data.schedules || []).map((s) => String(s.class_name)))].filter(Boolean)
        setClasses(allClasses)
      } catch (err) {
        console.error('Failed to fetch classes:', err)
        setClassError(err instanceof Error ? err.message : 'Gagal memuat kelas')
      }
    }

    fetchClasses()
  }, [])

  function handleFilterChange() {
    const params = new URLSearchParams()
    if (selectedClass) params.set('class', selectedClass)
    if (selectedDay) params.set('day', selectedDay)
    router.push(`/schedule?${params.toString()}`)
  }

  const scopeLabel = `${DAY_LABELS[selectedDay] ?? selectedDay}${selectedClass ? ` · Kelas ${selectedClass}` : ''}`

  return (
    <div className="flex flex-col gap-5 bg-surface-canvas text-text-primary">
      <PageHeader
        title="Jadwal Mengajar"
        crumbs={[{ label: 'Beranda', href: '/' }, { label: 'Jadwal Mengajar' }]}
        description="Jadwal mingguan yang sudah diimpor dari aSc Timetables v9.4. Saring per kelas dan per hari, lalu salik tautannya untuk dibagikan."
        actions={
          <>
            <ButtonLink href="/schedule/kelas" variant="secondary">
              <Table2 aria-hidden className="size-4" />
              Per Kelas
            </ButtonLink>
            <ButtonLink href="/schedule/import" variant="secondary">
              <CalendarPlus aria-hidden className="size-4" />
              Import Jadwal
            </ButtonLink>
          </>
        }
      />

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Jadwal Mingguan</CardTitle>
            <CardDescription>
              Kolom &ldquo;Periode&rdquo; adalah jam pelajaran ke-berapa, bukan periode penggajian.
            </CardDescription>
          </div>
          <Badge variant="neutral">
            {loading ? 'Memuat…' : `${schedules.length} sesi`}
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Filters */}
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              handleFilterChange()
            }}
          >
            <Field id="class" label="Kelas" className="w-full sm:w-56">
              {(field) => (
                <Select
                  {...field}
                  name="class"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">Semua Kelas</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field id="day" label="Hari" className="w-full sm:w-48">
              {(field) => (
                <Select
                  {...field}
                  name="day"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                >
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Button type="submit" variant="secondary">
              Terapkan
            </Button>
          </form>

          {scheduleError ? (
            <FeedbackBanner tone="error" onDismiss={() => setScheduleError(null)}>
              {scheduleError}
            </FeedbackBanner>
          ) : null}

          {classError ? (
            <FeedbackBanner tone="error" onDismiss={() => setClassError(null)}>
              {classError} — daftar kelas mungkin tidak lengkap.
            </FeedbackBanner>
          ) : null}

          {loading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : schedules.length === 0 ? (
            <EmptyState
              title="Belum ada jadwal"
              description="Tidak ada jadwal untuk filter yang dipilih. Coba pilih hari atau kelas lain, atau import jadwal baru dari aSc Timetables."
              action={
                <ButtonLink href="/schedule/import" variant="secondary">
                  <CalendarPlus aria-hidden className="size-4" />
                  Import Jadwal
                </ButtonLink>
              }
            />
          ) : (
            <TableScroll label={`Jadwal mengajar ${scopeLabel}`}>
              <Table className="min-w-[760px]">
                <TableCaption>Jadwal mengajar {scopeLabel}</TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-surface-sunken">
                    <TableHead>Kelas</TableHead>
                    <TableHead>Hari</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead>Guru</TableHead>
                    <TableHead>Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((sched) => (
                    <TableRow key={sched.id}>
                      <TableCell className="font-semibold whitespace-nowrap text-text-primary">
                        {sched.class_name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="neutral">{sched.day}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant="accent"
                          title="Jam pelajaran ke berapa pada hari ini"
                        >
                          {sched.period}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-text-primary">
                        {sched.subject_display || sched.subject}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{sched.teacher || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-text-primary">
                        {sched.start_time && sched.end_time ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock aria-hidden className="size-3.5 text-text-tertiary" />
                            {`${formatJam(sched.start_time)} - ${formatJam(sched.end_time)}`}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>
    </div>
  )
}