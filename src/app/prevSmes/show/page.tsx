import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const params = await searchParams
  return {
    title: params.class ? `Rekap KBM Kelas ${params.class} - NgajarYuk` : 'Rekap KBM - NgajarYuk',
  }
}

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
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Rekap KBM - Kelas {grade}
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Semester {semester} - Tahun {year}
              </p>
            </div>
            <a
              href="/prevSmes"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Kembali
            </a>
          </div>

          {/* View toggle */}
          <div className="mb-6 flex gap-2">
            <a
              href={`/prevSmes/show?class=${grade}&semester=${semester}&year=${year}&view=semester`}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                viewType === 'semester'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
              }`}
            >
              Semester
            </a>
            <a
              href={`/prevSmes/show?class=${grade}&semester=${semester}&year=${year}&view=daily&date=${selectedDate}`}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                viewType === 'daily'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
              }`}
            >
              Harian
            </a>
          </div>

          {/* Date picker for daily view */}
          {viewType === 'daily' && (
            <div className="mb-6">
              <label htmlFor="date" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Pilih Tanggal
              </label>
              <input
                type="date"
                id="date"
                defaultValue={selectedDate}
                form="dateForm"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <form id="dateForm" action={`/prevSmes/show?class=${grade}&semester=${semester}&year=${year}&view=daily`} method="GET" className="hidden">
                <input type="hidden" name="class" value={grade} />
                <input type="hidden" name="semester" value={semester} />
                <input type="hidden" name="year" value={year} />
                <input type="hidden" name="view" value="daily" />
              </form>
            </div>
          )}

          {/* KBM by date */}
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Jurnal KBM
            </h2>
            <div className="flex flex-col gap-4">
              {Array.from(kbmByDate.entries()).map(([date, notes]) => (
                <div key={date} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">
                    {new Date(date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                  {notes?.map((note) => (
                    <div key={note.id} className="mb-2 last:mb-0">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {note.subject} - {note.time}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {note.note}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
              {kbmByDate.size === 0 && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Tidak ada data KBM untuk periode ini.
                </p>
              )}
            </div>
          </div>

          {/* Absensi by date */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Presensi Siswa
            </h2>
            <div className="flex flex-col gap-4">
              {Object.entries(absentsByDate).map(([date, absents]) => (
                <div key={date} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">
                    {new Date(date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                  {absents.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {absents.map((abs, idx) => (
                        <li key={idx} className="text-sm text-zinc-700 dark:text-zinc-300">
                          {abs.name} -{' '}
                          <span
                            className={`font-medium ${
                              abs.value === 'S'
                                ? 'text-blue-600'
                                : abs.value === 'I'
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {abs.value === 'S' ? 'Sakit' : abs.value === 'I' ? 'Izin' : 'Alpha'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Tidak ada presensi untuk tanggal ini.
                    </p>
                  )}
                </div>
              ))}
              {Object.keys(absentsByDate).length === 0 && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Tidak ada data presensi untuk periode ini.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
