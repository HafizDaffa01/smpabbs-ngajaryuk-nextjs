import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarClock,
  CalendarRange,
  FileSpreadsheet,
  FolderTree,
  HardDriveDownload,
  Users,
  BookOpenCheck,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { TableScroll } from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import UserTable from './user-table'
import DashboardClient from './dashboard-client'

export const metadata = {
  title: 'Admin Dashboard - NgajarYuk',
  description: 'Dashboard admin',
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/unauthorized')
  }

  // Fetch statistics
  const { count: teachersCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin', false)

  const { count: adminsCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin', true)

  const { count: studentsCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })

  const { count: absensiCount } = await supabase
    .from('absensis')
    .select('*', { count: 'exact', head: true })

  // Journal totals for the "Jurnal Terisi" card: how many lesson notes exist
  // and how many of them have been signed off.
  const { count: notesCount } = await supabase
    .from('notes')
    .select('*', { count: 'exact', head: true })

  const { count: notesCheckedCount } = await supabase
    .from('notes')
    .select('*', { count: 'exact', head: true })
    .eq('checked', true)

  // Raw check-in timestamps for the last 7 days. Bucketing happens in the
  // client so the week lines up with the viewer's own clock and timezone.
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  weekStart.setHours(0, 0, 0, 0)

  const { data: weekRows } = await supabase
    .from('absensis')
    .select('waktu')
    .gte('waktu', weekStart.toISOString())
    .limit(2000)

  // Fetch all users except the super admin
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .neq('name', 'AdminABBS')
    .order('is_admin', { ascending: false })
    .order('name')

  // Fetch students grouped by class for popups
  const { data: students } = await supabase
    .from('students')
    .select('grade, name')
    .order('grade')
    .order('name')

  const studentsByClass = (students ?? []).reduce<Record<string, { name: string }[]>>((acc, s) => {
    const grade = s.grade || 'Kelas'
    if (!acc[grade]) acc[grade] = []
    acc[grade].push({ name: s.name })
    return acc
  }, {})

  // Determine current period key for popup link
  const today = new Date()
  const periods = [
    ['1', '2'], ['2', '3'], ['3', '4'], ['4', '5'], ['5', '6'], ['6', '7'],
    ['7', '8'], ['8', '9'], ['9', '10'], ['10', '11'], ['11', '12'], ['12', '1'],
  ]
  let currentKey = '1-2'
  for (const [startMonth, endMonth] of periods) {
    const start = new Date(today.getFullYear(), Number(startMonth) - 1, 21)
    const endMonthNum = Number(endMonth)
    const endYear = endMonthNum < Number(startMonth) ? today.getFullYear() + 1 : today.getFullYear()
    const end = new Date(endYear, endMonthNum - 1, 20)
    if (today >= start && today <= end) {
      currentKey = `${startMonth}-${endMonth}`
      break
    }
  }

  const classEntries = Object.entries(studentsByClass).filter(([key]) => key !== 'Kelas')
  const totalAccounts = (teachersCount ?? 0) + (adminsCount ?? 0)
  const teacherShare = totalAccounts === 0 ? 0 : Math.round(((teachersCount ?? 0) / totalAccounts) * 100)
  const averagePerClass =
    classEntries.length === 0 ? 0 : Math.round((studentsCount ?? 0) / classEntries.length)

  const shortcuts: { href: string; title: string; description: string; icon: LucideIcon }[] = [
    { href: '/admin/import', title: 'Import Siswa', description: 'Impor data siswa dari Excel', icon: FileSpreadsheet },
    { href: '/admin/import-teachers', title: 'Import Guru', description: 'Impor data guru dari Excel', icon: Users },
    { href: '/admin/tsmanager', title: 'TS Manager', description: 'Manajemen lengkap guru', icon: BookOpenCheck },
    { href: '/admin/absensi', title: 'Backup Absensi', description: 'Kelola data absensi backup', icon: CalendarClock },
    { href: '/schedule', title: 'Jadwal Mengajar', description: 'Kelola jadwal mengajar', icon: CalendarRange },
    { href: '/export', title: 'Backup Data', description: 'Export dan backup data', icon: HardDriveDownload },
    { href: '/explorer', title: 'File Explorer', description: 'Kelola file uploads', icon: FolderTree },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard Admin"
        crumbs={[{ label: 'Beranda', href: '/' }, { label: 'Admin' }]}
        description={
          <span className="flex flex-col gap-1">
            <span id="greeting" className="font-semibold text-text-primary">
              Selamat datang!
            </span>
            <span>Kelola data absensi, jurnal, dan jadwal dalam satu panel kontrol pusat.</span>
          </span>
        }
        actions={
          <div className="rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-right shadow-xs">
            <p id="clock" className="meta text-sm font-bold text-text-primary">
              --:--:--
            </p>
            <p id="date" className="text-[13px] text-text-tertiary">
              --
            </p>
          </div>
        }
      />

      <DashboardClient
        users={users ?? []}
        absensiCount={absensiCount ?? 0}
        studentsByClass={studentsByClass}
        currentKey={currentKey}
        stats={{
          teachersCount: teachersCount ?? 0,
          adminsCount: adminsCount ?? 0,
          accountsCount: totalAccounts,
          teacherShare,
          studentsCount: studentsCount ?? 0,
          averagePerClass,
          classCount: classEntries.length,
          notesCount: notesCount ?? 0,
          notesCheckedCount: notesCheckedCount ?? 0,
        }}
        weekTimes={(weekRows ?? []).map((row) => row.waktu as string)}
      />

      {/* Teachers management */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Teachers Management</CardTitle>
            <CardDescription>
              Semua akun guru dan admin, kecuali akun super admin sistem.
            </CardDescription>
          </div>
          {/* NOTE: this field is inert in the original markup — there is no
              filter wired to it. Kept as-is so the control does not silently
              disappear; see the migration report. */}
          <div className="w-full sm:w-72">
            <label htmlFor="searchUsers" className="sr-only">
              Cari pengguna
            </label>
            <Input id="searchUsers" type="text" placeholder="Search by name or email..." />
          </div>
        </CardHeader>
        <CardContent>
          <TableScroll label="Daftar pengguna">
            <UserTable users={users ?? []} />
          </TableScroll>
        </CardContent>
      </Card>

      {/* Shortcuts */}
      <section aria-labelledby="shortcut-heading" className="flex flex-col gap-3">
        <h2 id="shortcut-heading" className="eyebrow">
          Pintasan
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className={cn(
                'focus-ring group flex items-start gap-3 rounded-md border border-border-subtle',
                'bg-surface-card p-4 shadow-sm transition-[border-color,box-shadow,transform]',
                'duration-150 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md'
              )}
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-text transition-colors duration-150 ease-out group-hover:bg-accent group-hover:text-on-accent"
              >
                <shortcut.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-primary">
                  {shortcut.title}
                </span>
                <span className="mt-0.5 block text-[13px] text-text-tertiary">
                  {shortcut.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
