import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import JournalForm from './journal-form'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const params = await searchParams
  return {
    title: params.class ? `Jurnal Kelas ${params.class} - NgajarYuk` : 'Jurnal Kelas - NgajarYuk',
  }
}

export default async function JournalShowPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; usr?: string; month?: string; year?: string; day?: string }>
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
  const usr = params.usr ?? session.user.id

  if (!grade) {
    redirect('/journal')
  }

  const now = new Date()
  const day = params.day ? parseInt(params.day) : now.getDate()
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1
  const year = params.year ? parseInt(params.year) : now.getFullYear()

  // Build selected date
  const selectedDate = new Date(year, month - 1, day)
  const selectedDateStr = selectedDate.toISOString().split('T')[0]

  // Fetch students
  let studentsQuery = supabase.from('students').select('*').order('name')
  if (['7', '8', '9'].includes(grade)) {
    studentsQuery = studentsQuery.ilike('grade', `${grade}%`)
  } else {
    studentsQuery = studentsQuery.eq('grade', grade)
  }
  const { data: students } = await studentsQuery

  // Fetch schedules for current day of week
  const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' })

  let schedulesQuery = supabase
    .from('schedules')
    .select('*')
    .eq('day', dayOfWeek)
    .order('period')

  if (['7', '8', '9'].includes(grade)) {
    schedulesQuery = schedulesQuery.or(`class_name.ilike.${grade}%,subject.ilike.%Leadership%,subject_display.ilike.%Leadership%`)
  } else {
    schedulesQuery = schedulesQuery.eq('class_name', grade)
  }

  const { data: schedules } = await schedulesQuery

  // Fetch teachers from profiles (for teachers who teach this class)
  const teacherNames = [...new Set(schedules?.map((s) => s.teacher).filter(Boolean) ?? [])]

  // For leadership classes, also fetch teachers with Leadership in their mapel
  let leadershipTeachers: { name: string; mapel: Record<string, string[]> }[] = []
  if (['7', '8', '9'].includes(grade)) {
    const { data: allTeachers } = await supabase
      .from('profiles')
      .select('name, mapel')
      .eq('is_admin', false)

    leadershipTeachers =
      allTeachers?.filter((t) => {
        const mapel = t.mapel || {}
        return Object.entries(mapel).some(([k, v]) => {
          const kStr = String(k).toLowerCase()
          const hasLeadership = (Array.isArray(v) ? v : [v]).some((sv) =>
            String(sv).toLowerCase().includes('leadership')
          )
          if (hasLeadership) {
            return (
              kStr.startsWith(grade.toLowerCase()) ||
              String(v).toLowerCase().includes(grade.toLowerCase())
            )
          }
          return false
        })
      }) ?? []
  }

  // Build teachers list
  const teachersMap = new Map<string, { name: string; mapel: Record<string, string[]> }>()

  for (const t of leadershipTeachers) {
    teachersMap.set(t.name.toLowerCase(), { name: t.name, mapel: { [grade]: ['Leadership'] } })
  }

  for (const sched of schedules ?? []) {
    const tName = sched.teacher?.trim()
    if (!tName || tName === '-') continue
    const key = tName.toLowerCase()
    if (!teachersMap.has(key)) {
      // Try to get teacher's mapel from profiles
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('name, mapel')
        .eq('name', tName)
        .single()

      const mapel = teacherProfile?.mapel || {}
      teachersMap.set(key, { name: tName, mapel })
    }
  }

  const teachers = Array.from(teachersMap.values())

  // Build mapel list
  const mapelList: Record<string, string[]> = {}
  for (const t of teachers) {
    const subjects = t.mapel[grade]
    if (!subjects) continue
    if (typeof subjects === 'string') {
      if (!mapelList[subjects]) mapelList[subjects] = []
      if (!mapelList[subjects].includes(t.name)) {
        mapelList[subjects].push(t.name)
      }
    } else if (Array.isArray(subjects)) {
      for (const sub of subjects) {
        if (sub) {
          if (!mapelList[sub]) mapelList[sub] = []
          if (!mapelList[sub].includes(t.name)) {
            mapelList[sub].push(t.name)
          }
        }
      }
    }
  }

  // Fetch attendance for the month
  const studentIds = students?.map((s) => s.id) ?? []
  const { data: attendance } = await supabase
    .from('attendances')
    .select('*')
    .in('student_id', studentIds)
    .eq('month', month)
    .eq('year', year)

  const attendanceMap = new Map<string, Map<number, string>>()
  const summaryMap = new Map<number, { S: number; I: number; A: number }>()

  for (const s of students ?? []) {
    summaryMap.set(s.id, { S: 0, I: 0, A: 0 })
  }

  for (const att of attendance ?? []) {
    const studentAtt = attendanceMap.get(String(att.student_id))
    if (!studentAtt) {
      attendanceMap.set(String(att.student_id), new Map([[att.day, att.value]]))
    } else {
      studentAtt.set(att.day, att.value)
    }
    const sum = summaryMap.get(att.student_id)
    if (sum && sum[att.value as 'S' | 'I' | 'A'] !== undefined) {
      sum[att.value as 'S' | 'I' | 'A']++
    }
  }

  // Fetch notes for selected date
  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('class', grade)
    .eq('date', selectedDateStr)

  const noteIndexed = new Map(notes?.map((n) => [n.subject, n]) ?? [])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Jurnal Kelas {grade}
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {selectedDate.toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <a
              href="/journal"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Kembali
            </a>
          </div>

          <JournalForm
            grade={grade}
            day={day}
            month={month}
            year={year}
            students={students ?? []}
            mapelList={mapelList}
            attendanceMap={Object.fromEntries(
              Array.from(attendanceMap.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
            )}
            summaryMap={Object.fromEntries(summaryMap)}
            noteList={notes ?? []}
            noteIndexed={Object.fromEntries(noteIndexed)}
            schedules={schedules ?? []}
          />
        </div>
      </main>
    </div>
  )
}
