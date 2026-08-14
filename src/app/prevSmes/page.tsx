import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Rekap Semester - NgajarYuk',
  description: 'Pilih kelas untuk rekap',
}

export default async function RekapSelectPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Fetch distinct classes from schedules
  const { data: schedules } = await supabase
    .from('schedules')
    .select('class_name')
    .order('class_name')

  const rawClasses = [...new Set(schedules?.map((s) => s.class_name) ?? [])]

  // Group by grade
  const classes: Record<string, string[]> = {}
  for (const c of rawClasses) {
    const grade = c.charAt(0)
    const sub = c.slice(1)
    if (!classes[grade]) {
      classes[grade] = []
    }
    if (!classes[grade].includes(sub)) {
      classes[grade].push(sub)
    }
  }

  // Sort sub-classes
  for (const grade in classes) {
    classes[grade] = classes[grade].sort()
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Rekap KBM Card */}
          <form action="/prevSmes/show" method="GET" className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
            <input type="hidden" name="usr" value={session.user.id} />
            <div className="text-center mb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <span className="text-2xl">📊</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                Rekap KBM
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Pilih kelas untuk melihat rekapitulasi KBM selama 1 semester
              </p>
            </div>
            <div>
              <label htmlFor="classKbm" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Pilih Kelas
              </label>
              <select
                id="classKbm"
                name="class"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white dark:focus:ring-white"
              >
                <option value="" disabled selected>
                  -- Pilih Kelas --
                </option>
                {Object.entries(classes)
                  .filter(([grade]) => !['0', 'k', 'a'].includes(grade))
                  .map(([grade, subs]) => (
                    <optgroup key={grade} label={`Kelas ${grade}`}>
                      {grade in ['7', '8', '9'] && subs.length === 0 && (
                        <option value={grade}>Leadership Class {grade}</option>
                      )}
                      {subs.map((sub) => {
                        const full = grade + sub
                        const isPureNumber = /^\d+$/.test(full)
                        return (
                          <option key={full} value={full}>
                            {isPureNumber ? `Leadership Class ${full}` : full}
                          </option>
                        )
                      })}
                    </optgroup>
                  ))}
              </select>
            </div>
          </form>

          {/* Rekap Presensi Card */}
          <form action="/prevSmes/presensi" method="GET" className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
            <input type="hidden" name="usr" value={session.user.id} />
            <div className="text-center mb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <span className="text-2xl">📋</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                Rekap Presensi Siswa
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Pilih kelas untuk melihat rekapitulasi presensi siswa selama 1 semester
              </p>
            </div>
            <div>
              <label htmlFor="classPresensi" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Pilih Kelas
              </label>
              <select
                id="classPresensi"
                name="class"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white dark:focus:ring-white"
              >
                <option value="" disabled selected>
                  -- Pilih Kelas --
                </option>
                {Object.entries(classes)
                  .filter(([grade]) => !['0', 'k', 'a'].includes(grade))
                  .map(([grade, subs]) => (
                    <optgroup key={grade} label={`Kelas ${grade}`}>
                      {subs.map((sub) => {
                        const full = grade + sub
                        const isPureNumber = /^\d+$/.test(full)
                        return (
                          <option key={full} value={full}>
                            {isPureNumber ? `Leadership Class ${full}` : full}
                          </option>
                        )
                      })}
                    </optgroup>
                  ))}
              </select>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
