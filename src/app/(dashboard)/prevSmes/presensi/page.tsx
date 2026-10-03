import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft, HeartPulse } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { BarChart } from '@/components/ui/bar-chart'
import { StatCard } from '@/components/ui/stat-card'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Label, Select } from '@/components/ui/input'
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

export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const params = await searchParams
  return {
    title: params.class ? `Rekap Presensi Kelas ${params.class}` : 'Rekap Presensi',
  }
}

/**
 * S = sakit, I = izin, A = alpha. Each entry pairs the letter with its word so
 * the status is never carried by colour alone; the same pairing is repeated in
 * the legend, in the cell text and in the screen-reader caption.
 */
const ATTENDANCE: Record<string, { label: string; variant: 'warning' | 'info' | 'danger' }> = {
  S: { label: 'Sakit', variant: 'warning' },
  I: { label: 'Izin', variant: 'info' },
  A: { label: 'Alpha', variant: 'danger' },
}

const ATTENDANCE_VALUES = ['S', 'I', 'A'] as const

const MONTH_CELLS: Record<string, string> = {
  S: 'text-warning-text',
  I: 'text-info-text',
  A: 'text-danger-text',
}

const DAY_CELLS: Record<string, string> = {
  S: 'bg-warning-bg',
  I: 'bg-info-bg',
  A: 'bg-danger-bg',
}

export default async function RekapPresensiPage({
  searchParams,
}: {
  searchParams: Promise<{
    class?: string
    semester?: string
    year?: string
    view?: string
    month?: string
  }>
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const grade = (params.class ?? '').toUpperCase()
  const semester = params.semester ? parseInt(params.semester) : new Date().getMonth() <= 6 ? 1 : 2
  const year = params.year ? parseInt(params.year) : new Date().getFullYear()
  const viewType = params.view ?? 'semester'
  const selectedMonth = params.month ? parseInt(params.month) : new Date().getMonth() + 1

  const startMonthBound = semester === 1 ? 1 : 7
  const endMonthBound = semester === 1 ? 6 : 12

  const startMonth = viewType === 'monthly' ? selectedMonth : startMonthBound
  const endMonth = viewType === 'monthly' ? selectedMonth : endMonthBound

  // Fetch students
  let studentsQuery = supabase.from('students').select('*').order('name')
  if (['7', '8', '9'].includes(grade)) {
    studentsQuery = studentsQuery.ilike('grade', `${grade}%`)
  } else {
    studentsQuery = studentsQuery.eq('grade', grade)
  }
  const { data: students } = await studentsQuery

  const studentIds = students?.map((s) => s.id) ?? []

  // Fetch attendance for the whole semester range
  const { data: attendances } = await supabase
    .from('attendances')
    .select('*')
    .in('student_id', studentIds)
    .eq('year', year)
    .gte('month', startMonth)
    .lte('month', endMonth)

  // Organize attendance by [student_id][month][day]
  const attendanceMap: Record<number, Record<number, Record<number, string>>> = {}
  const summary: Record<number, { S: number; I: number; A: number }> = {}

  for (const s of students ?? []) {
    summary[s.id] = { S: 0, I: 0, A: 0 }
  }

  for (const att of attendances ?? []) {
    if (!attendanceMap[att.student_id]) {
      attendanceMap[att.student_id] = {}
    }
    if (!attendanceMap[att.student_id][att.month]) {
      attendanceMap[att.student_id][att.month] = {}
    }
    attendanceMap[att.student_id][att.month][att.day] = att.value
    if (summary[att.student_id] && summary[att.student_id][att.value as 'S' | 'I' | 'A'] !== undefined) {
      summary[att.student_id][att.value as 'S' | 'I' | 'A']++
    }
  }

  // --- Derived summaries (presentation only; no new queries) ---------------
  const absencesPerBucket = new Map<number, number>()
  for (const att of attendances ?? []) {
    if (!(ATTENDANCE_VALUES as readonly string[]).includes(att.value)) continue
    const bucket = viewType === 'monthly' ? Number(att.day) : Number(att.month)
    if (!bucket) continue
    absencesPerBucket.set(bucket, (absencesPerBucket.get(bucket) ?? 0) + 1)
  }

  const daysInSelectedMonth = new Date(year, selectedMonth, 0).getDate()
  const selectedMonthName = new Date(year, selectedMonth - 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })

  const chartData =
    viewType === 'monthly'
      ? Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((d) => ({
          label: String(d),
          value: absencesPerBucket.get(d) ?? 0,
          description: `Tanggal ${d}`,
        }))
      : Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map((m) => ({
          label: new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'short' }),
          value: absencesPerBucket.get(m) ?? 0,
        }))

  const classTotals = { S: 0, I: 0, A: 0 }
  for (const att of attendances ?? []) {
    if ((ATTENDANCE_VALUES as readonly string[]).includes(att.value)) {
      classTotals[att.value as 'S' | 'I' | 'A']++
    }
  }

  const periodLabel = `Semester ${semester} - Tahun ${year}`
  const viewHref = (view: string, extra?: string) =>
    `/prevSmes/presensi?class=${grade}&semester=${semester}&year=${year}&view=${view}${
      extra ? `&${extra}` : ''
    }`

  return (
    <div className="flex flex-col gap-5 bg-surface-canvas text-text-primary">
      <PageHeader
        title={`Rekap Presensi - Kelas ${grade}`}
        crumbs={[
          { label: 'Beranda', href: '/' },
          { label: 'Rekap Semester', href: '/prevSmes' },
          { label: `Presensi Kelas ${grade}` },
        ]}
        description={periodLabel}
        actions={
          <>
            <Badge variant="accent">{periodLabel}</Badge>
            <ButtonLink href="/prevSmes" variant="secondary">
              <ArrowLeft aria-hidden className="size-4" />
              Kembali
            </ButtonLink>
          </>
        }
      />

      {/* View toggle */}
      <div className="flex flex-wrap gap-2">
        <ButtonLink
          href={viewHref('semester')}
          variant={viewType === 'semester' ? 'primary' : 'secondary'}
          aria-current={viewType === 'semester' ? 'page' : undefined}
        >
          Semester
        </ButtonLink>
        <ButtonLink
          href={viewHref('monthly', `month=${selectedMonth}`)}
          variant={viewType === 'monthly' ? 'primary' : 'secondary'}
          aria-current={viewType === 'monthly' ? 'page' : undefined}
        >
          Bulanan
        </ButtonLink>
      </div>

      {/* Month picker for monthly view */}
      {viewType === 'monthly' && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <Label htmlFor="month">Pilih Bulan</Label>
              <p className="mt-0.5 text-[13px] text-text-tertiary">
                Bulan ini menentukan kolom mana yang dimuat pada tabel rekap.
              </p>
            </div>
            <Select
              id="month"
              defaultValue={selectedMonth}
              form="monthForm"
              className="w-full sm:w-56"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'long' })}
                </option>
              ))}
            </Select>
            <form
              id="monthForm"
              action={`/prevSmes/presensi?class=${grade}&semester=${semester}&year=${year}&view=monthly`}
              method="GET"
              className="hidden"
            >
              <input type="hidden" name="class" value={grade} />
              <input type="hidden" name="semester" value={semester} />
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="view" value="monthly" />
            </form>
          </CardContent>
        </Card>
      )}

      {/* Summary tiles + absence chart */}
      <section aria-labelledby="ringkasan-heading" className="flex flex-col gap-3">
        <h2
          id="ringkasan-heading"
          className="text-sm font-semibold tracking-[0.02em] text-text-tertiary uppercase"
        >
          Ringkasan
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Siswa"
            value={(students ?? []).length}
            hint={`Terdaftar di kelas ${grade}`}
            tone="accent"
            icon={<HeartPulse className="size-5" />}
          />
          <StatCard label="Sakit" value={classTotals.S} tone="warning" />
          <StatCard label="Izin" value={classTotals.I} tone="info" />
          <StatCard label="Alpha" value={classTotals.A} tone="danger" />
        </div>

        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle as="h3">
                {viewType === 'monthly'
                  ? `Ketidakhadiran per Hari — ${selectedMonthName}`
                  : `Ketidakhadiran per Bulan — ${periodLabel}`}
              </CardTitle>
              <CardDescription>
                Jumlah catatan sakit, izin, dan alpha pada rentang yang sedang ditampilkan.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={chartData}
              ariaLabel={
                viewType === 'monthly'
                  ? `Grafik ketidakhadiran siswa kelas ${grade} per tanggal pada ${selectedMonthName}`
                  : `Grafik ketidakhadiran siswa kelas ${grade} per bulan, ${periodLabel}`
              }
              valueLabel="Ketidakhadiran"
              unit="catatan"
            />
          </CardContent>
        </Card>
      </section>

      {/* Attendance matrix */}
      <section aria-labelledby="tabel-heading" className="flex flex-col gap-3">
        <h2
          id="tabel-heading"
          className="text-sm font-semibold tracking-[0.02em] text-text-tertiary uppercase"
        >
          Matriks Presensi
        </h2>

        <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-tertiary">
          <span>Legenda:</span>
          {ATTENDANCE_VALUES.map((code) => (
            <Badge key={code} variant={ATTENDANCE[code].variant}>
              {code} &middot; {ATTENDANCE[code].label}
            </Badge>
          ))}
          <span>Tanda &ldquo;-&rdquo; berarti tidak ada catatan ketidakhadiran.</span>
        </div>

        {!students || students.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                title="Belum ada siswa"
                description={`Tidak ada siswa terdaftar di kelas ${grade} pada tahun ${year}. Periksa penulisan nama kelas, lalu coba lagi.`}
                action={
                  <ButtonLink href="/prevSmes" variant="secondary">
                    Ganti kelas
                  </ButtonLink>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <TableScroll maxHeight="70vh" label={`Rekap presensi kelas ${grade}`}>
                <Table
                  className={
                    viewType === 'monthly' ? 'min-w-[860px]' : 'min-w-[720px]'
                  }
                >
                  <TableCaption>
                    Rekap presensi kelas {grade}, {periodLabel}. S = sakit, I = izin,
                    A = alpha. Kolom ringkasan menampilkan jumlah masing-masing status.
                  </TableCaption>
                  <TableHeader>
                    <TableRow className="hover:bg-surface-sunken">
                      <TableHead className="sticky left-0">Nama Siswa</TableHead>
                      {viewType === 'semester'
                        ? Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map((m) => (
                            <TableHead key={m} className="text-center">
                              {new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'short' })}
                            </TableHead>
                          ))
                        : Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((d) => (
                            <TableHead key={d} className="text-center">
                              {d}
                            </TableHead>
                          ))}
                      <TableHead className="text-center">Ringkasan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => {
                      const studentAttendance = attendanceMap[student.id] || {}
                      const studentSummary = summary[student.id] || { S: 0, I: 0, A: 0 }

                      return (
                        <TableRow key={student.id}>
                          <TableCell className="sticky left-0 z-0 bg-surface-card font-semibold whitespace-nowrap text-text-primary">
                            {student.name}
                          </TableCell>
                          {viewType === 'semester'
                            ? Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map((m) => {
                                const monthData = studentAttendance[m] || {}
                                const daysWithAttendance = Object.keys(monthData).length
                                const sickDays = Object.values(monthData).filter((v) => v === 'S').length
                                const excusedDays = Object.values(monthData).filter((v) => v === 'I').length
                                const absentDays = Object.values(monthData).filter((v) => v === 'A').length

                                return (
                                  <TableCell key={m} className="text-center whitespace-nowrap">
                                    {daysWithAttendance > 0 ? (
                                      <span className="flex flex-col gap-1 text-[13px] font-semibold">
                                        {sickDays > 0 && (
                                          <span className={MONTH_CELLS.S}>S:{sickDays}</span>
                                        )}
                                        {excusedDays > 0 && (
                                          <span className={MONTH_CELLS.I}>I:{excusedDays}</span>
                                        )}
                                        {absentDays > 0 && (
                                          <span className={MONTH_CELLS.A}>A:{absentDays}</span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-text-tertiary">-</span>
                                    )}
                                  </TableCell>
                                )
                              })
                            : Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((d) => {
                                const monthData = studentAttendance[selectedMonth] || {}
                                const value = monthData[d]

                                return (
                                  <TableCell
                                    key={d}
                                    className={`text-center font-semibold ${DAY_CELLS[value] ?? ''}`}
                                  >
                                    {value ? (
                                      <span title={ATTENDANCE[value]?.label}>
                                        {value}
                                        <span className="sr-only">
                                          {' '}
                                          — {ATTENDANCE[value]?.label ?? 'Alpha'}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="font-normal text-text-tertiary">-</span>
                                    )}
                                  </TableCell>
                                )
                              })}
                          <TableCell className="text-center whitespace-nowrap">
                            <span className="flex flex-wrap items-center justify-center gap-1">
                              {ATTENDANCE_VALUES.map((code) => (
                                <Badge key={code} variant={ATTENDANCE[code].variant}>
                                  {code}: {studentSummary[code]}
                                </Badge>
                              ))}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableScroll>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}