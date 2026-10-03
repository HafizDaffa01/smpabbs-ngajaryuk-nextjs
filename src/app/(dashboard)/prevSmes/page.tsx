import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CalendarDays, ChartColumnBig, ClipboardList, type LucideIcon } from 'lucide-react'
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
import { Field, Select } from '@/components/ui/input'
import { getCurrentPeriod } from '@/lib/period-system'

export const metadata = {
  title: 'Rekap Semester',
  description: 'Pilih kelas untuk rekap',
}

type RecapKind = {
  id: string
  action: string
  title: string
  description: string
  icon: LucideIcon
  iconTone: string
}

export default async function RekapSelectPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
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

  const gradeGroups = Object.entries(classes).filter(([grade]) =>
    !['0', 'k', 'a'].includes(grade)
  )

  const recaps: RecapKind[] = [
    {
      id: 'classKbm',
      action: '/prevSmes/show',
      title: 'Rekap KBM',
      description: 'Pilih kelas untuk melihat rekapitulasi KBM selama 1 semester',
      icon: ChartColumnBig,
      iconTone: 'border-success-border bg-success-bg text-success-text',
    },
    {
      id: 'classPresensi',
      action: '/prevSmes/presensi',
      title: 'Rekap Presensi Siswa',
      description:
        'Pilih kelas untuk melihat rekapitulasi presensi siswa selama 1 semester',
      icon: ClipboardList,
      iconTone: 'border-info-border bg-info-bg text-info-text',
    },
  ]

  return (
    <div className="flex flex-col gap-5 bg-surface-canvas text-text-primary">
      <PageHeader
        title="Rekap Semester"
        crumbs={[{ label: 'Beranda', href: '/' }, { label: 'Rekap Semester' }]}
        description="Pilih jenis rekap dan kelas yang ingin dilihat. Semester dan tahun diambil dari tanggal hari ini, jadi tidak ada yang perlu dipilih lagi."
        actions={
          <Badge variant="neutral">
            <CalendarDays aria-hidden className="size-3.5" />
            {getCurrentPeriod().label}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        {recaps.map((recap) => {
          const Icon = recap.icon
          const hasClasses = gradeGroups.length > 0

          return (
            // Each card is its own GET form — navigation, not mutation.
            <form
              key={recap.id}
              action={recap.action}
              method="GET"
              className="flex"
            >
              <input type="hidden" name="usr" value={user.id} />
              <Card className="flex w-full flex-col">
                <CardHeader>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className={`flex size-11 shrink-0 items-center justify-center rounded-md border ${recap.iconTone}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle>{recap.title}</CardTitle>
                      <CardDescription>{recap.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col justify-end gap-4">
                  {hasClasses ? (
                    <>
                      <Field id={recap.id} label="Pilih Kelas" required>
                        {(field) => (
                          <Select {...field} name="class" required defaultValue="">
                            <option value="" disabled>
                              -- Pilih Kelas --
                            </option>
                            {gradeGroups.map(([grade, subs]) => (
                              <optgroup key={grade} label={`Kelas ${grade}`}>
                                {/* NOTE: preserved verbatim — `x in [...]` tests array
                                    indices, so this Leadership injection never fires. */}
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
                          </Select>
                        )}
                      </Field>

                      <Button type="submit" size="lg" className="w-full">
                        Lihat Rekap
                      </Button>
                    </>
                  ) : (
                    <EmptyState
                      title="Belum ada kelas"
                      description="Daftar kelas diambil dari jadwal, dan jadwal masih kosong untuk periode ini. Import jadwal terlebih dahulu agar rekap bisa dibuka."
                      action={
                        <ButtonLink href="/schedule" variant="secondary">
                          Lihat Jadwal
                        </ButtonLink>
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </form>
          )
        })}
      </div>
    </div>
  )
}