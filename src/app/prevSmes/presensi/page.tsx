import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const params = await searchParams
  return {
    title: params.class ? `Rekap Presensi Kelas ${params.class} - NgajarYuk` : 'Rekap Presensi - NgajarYuk',
  }
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Rekap Presensi - Kelas {grade}
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
              href={`/prevSmes/presensi?class=${grade}&semester=${semester}&year=${year}&view=semester`}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                viewType === 'semester'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
              }`}
            >
              Semester
            </a>
            <a
              href={`/prevSmes/presensi?class=${grade}&semester=${semester}&year=${year}&view=monthly&month=${selectedMonth}`}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                viewType === 'monthly'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
              }`}
            >
              Bulanan
            </a>
          </div>

          {/* Month picker for monthly view */}
          {viewType === 'monthly' && (
            <div className="mb-6">
              <label htmlFor="month" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Pilih Bulan
              </label>
              <select
                id="month"
                defaultValue={selectedMonth}
                form="monthForm"
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'long' })}
                  </option>
                ))}
              </select>
              <form id="monthForm" action={`/prevSmes/presensi?class=${grade}&semester=${semester}&year=${year}&view=monthly`} method="GET" className="hidden">
                <input type="hidden" name="class" value={grade} />
                <input type="hidden" name="semester" value={semester} />
                <input type="hidden" name="year" value={year} />
                <input type="hidden" name="view" value="monthly" />
              </form>
            </div>
          )}

          {/* Attendance Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-700">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800">
                  <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Nama Siswa
                  </th>
                  {viewType === 'semester'
                    ? Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map((m) => (
                        <th
                          key={m}
                          className="border border-zinc-300 px-2 py-2 text-center text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                        >
                          {new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'short' })}
                        </th>
                      ))
                    : Array.from({ length: new Date(year, selectedMonth, 0).getDate() }, (_, i) => i + 1).map((d) => (
                        <th
                          key={d}
                          className="border border-zinc-300 px-2 py-2 text-center text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                        >
                          {d}
                        </th>
                      ))}
                  <th className="border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Ringkasan
                  </th>
                </tr>
              </thead>
              <tbody>
                {students?.map((student) => {
                  const studentAttendance = attendanceMap[student.id] || {}
                  const studentSummary = summary[student.id] || { S: 0, I: 0, A: 0 }

                  return (
                    <tr key={student.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                        {student.name}
                      </td>
                      {viewType === 'semester'
                        ? Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map((m) => {
                            const monthData = studentAttendance[m] || {}
                            const daysWithAttendance = Object.keys(monthData).length
                            const sickDays = Object.values(monthData).filter((v) => v === 'S').length
                            const excusedDays = Object.values(monthData).filter((v) => v === 'I').length
                            const absentDays = Object.values(monthData).filter((v) => v === 'A').length

                            return (
                              <td
                                key={m}
                                className="border border-zinc-300 px-2 py-2 text-center text-xs dark:border-zinc-700"
                              >
                                {daysWithAttendance > 0 ? (
                                  <div className="flex flex-col gap-1">
                                    {sickDays > 0 && (
                                      <span className="text-blue-600 dark:text-blue-400">S:{sickDays}</span>
                                    )}
                                    {excusedDays > 0 && (
                                      <span className="text-yellow-600 dark:text-yellow-400">I:{excusedDays}</span>
                                    )}
                                    {absentDays > 0 && (
                                      <span className="text-red-600 dark:text-red-400">A:{absentDays}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-zinc-400">-</span>
                                )}
                              </td>
                            )
                          })
                        : Array.from({ length: new Date(year, selectedMonth, 0).getDate() }, (_, i) => i + 1).map((d) => {
                            const monthData = studentAttendance[selectedMonth] || {}
                            const value = monthData[d]

                            return (
                              <td
                                key={d}
                                className={`border border-zinc-300 px-2 py-2 text-center text-xs dark:border-zinc-700 ${
                                  value === 'S'
                                    ? 'bg-blue-50 dark:bg-blue-900/20'
                                    : value === 'I'
                                      ? 'bg-yellow-50 dark:bg-yellow-900/20'
                                      : value === 'A'
                                        ? 'bg-red-50 dark:bg-red-900/20'
                                        : ''
                                }`}
                              >
                                {value ? (
                                  <span
                                    className={`font-medium ${
                                      value === 'S'
                                        ? 'text-blue-600'
                                        : value === 'I'
                                          ? 'text-yellow-600'
                                          : 'text-red-600'
                                    }`}
                                  >
                                    {value}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400">-</span>
                                )}
                              </td>
                            )
                          })}
                      <td className="border border-zinc-300 px-4 py-2 text-center text-sm dark:border-zinc-700">
                        <span className="text-blue-600 dark:text-blue-400">S: {studentSummary.S}</span>
                        {' | '}
                        <span className="text-yellow-600 dark:text-yellow-400">I: {studentSummary.I}</span>
                        {' | '}
                        <span className="text-red-600 dark:text-red-400">A: {studentSummary.A}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
