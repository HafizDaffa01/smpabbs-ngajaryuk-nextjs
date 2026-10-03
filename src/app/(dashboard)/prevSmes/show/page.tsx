import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, NotebookPen } from 'lucide-react'
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
import { Input, Label } from '@/components/ui/input'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const params = await searchParams
  return {
    title: params.class ? `Rekap KBM Kelas ${params.class}` : 'Rekap KBM',
  }
}

/** `S`/`I`/`A` attendance codes and their Indonesian labels. */
const ATTENDANCE: Record<string, { label: string; variant: 'warning' | 'info' | 'danger' }> = {
  S: { label: 'Sakit', variant: 'warning' },
  I: { label: 'Izin', variant: 'info' },
  A: { label: 'Alpha', variant: 'danger' },
}

const ATTENDANCE_VALUES = ['S', 'I', 'A'] as const

export default async function RekapShowPage({
  searchParams,
}: {
  searchParams: Promise<{
    class?: string
    semester?: string
    year?: string
    view?: string
    date?: string
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
  const selectedDate = params.date ?? new Date().toISOString().split('T')[0]

  const startMonth = semester === 1 ? 1 : 7
  const endMonth = semester === 1 ? 6 : 12

  const carbonDate = new Date(selectedDate)
  const startDate = viewType === 'daily' ? selectedDate : `${year}-${String(startMonth).padStart(2, '0')}-01`
  const endDate =
    viewType === 'daily'
      ? selectedDate
      : `${year}-${String(endMonth).padStart(2, '0')}-${endMonth === 6 ? '30' : '31'}`

  // Fetch students
  let studentsQuery = supabase.from('students').select('*').order('name')
  if (['7', '8', '9'].includes(grade)) {
    studentsQuery = studentsQuery.ilike('grade', `${grade}%`)
  } else {
    studentsQuery = studentsQuery.eq('grade', grade)
  }
  const { data: students } = await studentsQuery

  const studentIds = students?.map((s) => s.id) ?? []

  // Fetch attendance
  const { data: attendanceData } = await supabase
    .from('attendances')
    .select('*')
    .in('student_id', studentIds)
    .eq('year', year)
    .gte('month', startMonth)
    .lte('month', endMonth)
    .in('value', ['S', 'I', 'A'])

  const absentsByDate: Record<string, { name: string; value: string }[]> = {}
  for (const att of attendanceData ?? []) {
    const dateKey = `${att.year}-${String(att.month).padStart(2, '0')}-${String(att.day).padStart(2, '0')}`
    if (!absentsByDate[dateKey]) {
      absentsByDate[dateKey] = []
    }
    const student = students?.find((s) => s.id === att.student_id)
    absentsByDate[dateKey].push({
      name: student?.name ?? 'Unknown',
      value: att.value,
    })
  }

  // Fetch KBM notes
  const { data: kbmData } = await supabase
    .from('notes')
    .select('*')
    .eq('class', grade)
    .gte('date', startDate)
    .lte('date', endDate)

  const kbmByDate = new Map<string, typeof kbmData>()
  for (const note of kbmData ?? []) {
    const existing = kbmByDate.get(note.date) ?? []
    existing.push(note)
    kbmByDate.set(note.date, existing)
  }

  // Fetch schedules
  const gradeLevel = grade.replace(/[^0-9]/g, '')
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .or(`class_name.eq.${grade},class_name.eq.${gradeLevel}`)

  const schedulesByDay = new Map<string, typeof schedules>()
  for (const sched of schedules ?? []) {
    const existing = schedulesByDay.get(sched.day) ?? []
    existing.push(sched)
    schedulesByDay.set(sched.day, existing)
  }

  // --- Derived summaries (presentation only; no new queries) ---------------
  const notesPerMonth = new Map<number, number>()
  for (const note of kbmData ?? []) {
    const month = Number(String(note.date).slice(5, 7))
    if (!month) continue
    notesPerMonth.set(month, (notesPerMonth.get(month) ?? 0) + 1)
  }

  const kbmChartData =
    viewType === 'semester'
      ? Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map((m) => ({
          label: new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'short' }),
          value: notesPerMonth.get(m) ?? 0,
        }))
      : []

  const totals = { S: 0, I: 0, A: 0 }
  for (const att of attendanceData ?? []) {
    if ((ATTENDANCE_VALUES as readonly string[]).includes(att.value)) {
      totals[att.value as 'S' | 'I' | 'A']++
    }
  }
  const totalAbsences = totals.S + totals.I + totals.A

  const periodLabel = `Semester ${semester} - Tahun ${year}`
  const viewHref = (view: string, extra?: string) =>
    `/prevSmes/show?class=${grade}&semester=${semester}&year=${year}&view=${view}${
      extra ? `&${extra}` : ''
    }`

  return (
    <div className="flex flex-col gap-5 bg-surface-canvas text-text-primary">
      <PageHeader
        title={`Rekap KBM - Kelas ${grade}`}
        crumbs={[
          { label: 'Beranda', href: '/' },
          { label: 'Rekap Semester', href: '/prevSmes' },
          { label: `KBM Kelas ${grade}` },
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
          href={viewHref('daily', `date=${selectedDate}`)}
          variant={viewType === 'daily' ? 'primary' : 'secondary'}
          aria-current={viewType === 'daily' ? 'page' : undefined}
        >
          Harian
        </ButtonLink>
      </div>

      {/* Date picker for daily view */}
      {viewType === 'daily' && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <Label htmlFor="date">Pilih Tanggal</Label>
              <p className="mt-0.5 text-[13px] text-text-tertiary">
                Tanggal ini menentukan jurnal dan presensi yang ditampilkan.
              </p>
            </div>
            <Input
              type="date"
              id="date"
              defaultValue={selectedDate}
              form="dateForm"
              className="w-full sm:w-56"
            />
            <form
              id="dateForm"
              action={`/prevSmes/show?class=${grade}&semester=${semester}&year=${year}&view=daily`}
              method="GET"
              className="hidden"
            >
              <input type="hidden" name="class" value={grade} />
              <input type="hidden" name="semester" value={semester} />
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="view" value="daily" />
            </form>
          </CardContent>
        </Card>
      )}

      {/* Summary tiles + monthly journal chart */}
      <section aria-labelledby="ringkasan-heading" className="flex flex-col gap-3">
        <h2 id="ringkasan-heading" className="text-sm font-semibold tracking-[0.02em] text-text-tertiary uppercase">
          Ringkasan
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Jurnal KBM"
            value={(kbmData ?? []).length}
            hint={`Periode ${periodLabel}`}
            tone="accent"
            icon={<NotebookPen className="size-5" />}
          />
          <StatCard
            label="Sakit"
            value={totals.S}
            hint="Siswa tidak hadir karena sakit"
            tone="warning"
          />
          <StatCard
            label="Izin"
            value={totals.I}
            hint="Siswa tidak hadir karena izin"
            tone="info"
          />
          <StatCard
            label="Alpha"
            value={totals.A}
            hint="Siswa tidak hadir tanpa keterangan"
            tone="danger"
          />
        </div>

        {viewType === 'semester' ? (
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle as="h3">Jurnal KBM per Bulan</CardTitle>
                <CardDescription>
                  Jumlah jurnal yang tercatat pada tiap bulan dalam {periodLabel}.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <BarChart
                data={kbmChartData}
                ariaLabel={`Grafik jumlah jurnal KBM kelas ${grade} per bulan, ${periodLabel}`}
                valueLabel="Jurnal"
                unit="jurnal"
              />
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* KBM by date */}
      <section aria-labelledby="jurnal-kbm-heading" className="flex flex-col gap-3">
        <h2 id="jurnal-kbm-heading" className="text-sm font-semibold tracking-[0.02em] text-text-tertiary uppercase">
          Jurnal KBM
        </h2>

        {kbmByDate.size === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                title="Belum ada jurnal KBM"
                description="Tidak ada data KBM untuk periode ini. Jurnal muncul setelah guru mengisi catatan Override di halaman jurnal pada tanggal yang dipilih."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {Array.from(kbmByDate.entries()).map(([date, notes]) => (
              <Card key={date}>
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle as="h3">
                      {new Date(date).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </CardTitle>
                    <CardDescription>
                      {notes?.length ?? 0} catatan pada tanggal ini
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {notes?.map((note) => (
                    <div key={note.id} className="flex flex-col gap-1 border-l-2 border-border-subtle pl-3">
                      <p className="text-sm font-semibold text-text-primary">
                        {note.subject} - {note.time}
                      </p>
                      <p className="text-[13px] text-text-secondary">{note.note}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Absensi by date */}
      <section aria-labelledby="presensi-siswa-heading" className="flex flex-col gap-3">
        <h2 id="presensi-siswa-heading" className="text-sm font-semibold tracking-[0.02em] text-text-tertiary uppercase">
          Presensi Siswa
        </h2>

        {Object.keys(absentsByDate).length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                title="Belum ada ketidakhadiran"
                description="Tidak ada data presensi untuk periode ini. Rekap ini hanya memuat catatan S, I, dan A — hari dengan kehadiran penuh tidak dicatat di sini."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-tertiary">
              <span>Legenda:</span>
              {ATTENDANCE_VALUES.map((code) => (
                <Badge key={code} variant={ATTENDANCE[code].variant}>
                  {code} &middot; {ATTENDANCE[code].label}
                </Badge>
              ))}
              <span>
                Total {totalAbsences} ketidakhadiran pada periode ini.
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {Object.entries(absentsByDate).map(([date, absents]) => (
                <Card key={date}>
                  <CardHeader>
                    <div className="min-w-0">
                      <CardTitle as="h3">
                        {new Date(date).toLocaleDateString('id-ID', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </CardTitle>
                      <CardDescription>
                        {absents.length > 0
                          ? `${absents.length} siswa tidak hadir`
                          : 'Tidak ada ketidakhadiran'}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {absents.length > 0 ? (
                      <ul className="flex flex-col gap-1.5">
                        {absents.map((abs, idx) => {
                          const meta = ATTENDANCE[abs.value] ?? {
                            label: 'Alpha',
                            variant: 'danger' as const,
                          }
                          return (
                            <li
                              key={idx}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border-subtle px-2.5 py-1.5"
                            >
                              <span className="text-sm font-medium text-text-primary">
                                {abs.name}
                              </span>
                              <Badge variant={meta.variant}>
                                {abs.value} &middot; {meta.label}
                              </Badge>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-text-tertiary">
                        Tidak ada presensi untuk tanggal ini.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      <p className="text-[13px] text-text-tertiary">
        <Link
          href={`/prevSmes/presensi?class=${grade}&semester=${semester}&year=${year}`}
          className="rounded-sm font-medium text-accent-text underline underline-offset-2 transition-colors duration-150 ease-out hover:text-accent-hover"
        >
          Lihat rekap presensi lengkap untuk kelas {grade}
        </Link>
      </p>
    </div>
  )
}