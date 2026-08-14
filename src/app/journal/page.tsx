import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Pilih Kelas - Jurnal - NgajarYuk',
  description: 'Pilih kelas untuk jurnal',
}

export default async function JournalSelectPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', session.user.id)
    .single()

  if (!profiles) {
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
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Jurnal Kelas
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Pilih kelas untuk melihat catatan jurnal pembelajaran harian
            </p>
          </div>

          <form action="/journal/show" method="GET" className="flex flex-col gap-4">
            <input type="hidden" name="usr" value={session.user.id} />

            <div>
              <label htmlFor="classSelect" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Kelas
              </label>
              <select
                id="classSelect"
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

            <button
              type="submit"
              className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Lanjutkan
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
