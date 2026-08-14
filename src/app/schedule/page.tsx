import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; day?: string }>
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
  const selectedClass = params.class ?? ''
  const selectedDay = params.day ?? 'Monday'
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Fetch all classes
  const { data: allSchedules } = await supabase.from('schedules').select('class_name').order('class_name')
  const classes = [...new Set(allSchedules?.map((s) => s.class_name) ?? [])]

  // Fetch schedules for selected class and day
  let schedulesQuery = supabase.from('schedules').select('*').order('period')
  if (selectedClass) {
    schedulesQuery = schedulesQuery.eq('class_name', selectedClass)
  }
  if (selectedDay) {
    schedulesQuery = schedulesQuery.eq('day', selectedDay)
  }
  const { data: schedules } = await schedulesQuery

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Jadwal Mengajar
          </h1>

          {/* Filters */}
          <form className="mb-6 flex flex-wrap gap-4">
            <div>
              <label htmlFor="class" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Kelas
              </label>
              <select
                id="class"
                name="class"
                defaultValue={selectedClass}
                onChange={(e) => {
                  const form = e.target.form
                  if (form) form.submit()
                }}
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="day" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Hari
              </label>
              <select
                id="day"
                name="day"
                defaultValue={selectedDay}
                onChange={(e) => {
                  const form = e.target.form
                  if (form) form.submit()
                }}
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </form>

          {/* Schedule Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-700">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800">
                  <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Kelas
                  </th>
                  <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Hari
                  </th>
                  <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Periode
                  </th>
                  <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Mapel
                  </th>
                  <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Guru
                  </th>
                  <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Waktu
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedules?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="border border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                      Tidak ada jadwal untuk filter yang dipilih.
                    </td>
                  </tr>
                )}
                {schedules?.map((sched) => (
                  <tr key={sched.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      {sched.class_name}
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      {sched.day}
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      {sched.period}
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      {sched.subject_display || sched.subject}
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      {sched.teacher || '-'}
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      {sched.start_time && sched.end_time
                        ? `${sched.start_time.slice(0, 5)} - ${sched.end_time.slice(0, 5)}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
