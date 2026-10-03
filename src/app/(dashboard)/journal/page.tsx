import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label, Select } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata = {
  title: 'Pilih Kelas - Jurnal',
  description: 'Pilih kelas untuk jurnal',
}

export default async function JournalSelectPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
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

  const hasClasses = rawClasses.length > 0

  return (
    <>
      <PageHeader
        title="Jurnal Kelas"
        crumbs={[{ label: 'Beranda', href: '/' }]}
        description="Pilih kelas untuk melihat catatan jurnal pembelajaran harian"
      />

      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6">
              <div
                className="flex size-16 shrink-0 items-center justify-center rounded-sm bg-accent-subtle text-accent"
                aria-hidden
              >
                <BookOpen className="size-8" />
              </div>

              {hasClasses ? (
                <form action="/journal/show" method="GET" className="w-full">
                  <input type="hidden" name="usr" value={user.id} />

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="classSelect">Kelas</Label>
                      <Select
                        id="classSelect"
                        name="class"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
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
                      </Select>
                    </div>

                    <Button type="submit" variant="primary" className="w-full">
                      Lanjutkan
                    </Button>
                  </div>
                </form>
              ) : (
                <EmptyState
                  title="Belum ada jadwal kelas"
                  description="Tidak ada kelas yang tersedia untuk dipilih. Pastikan jadwal sudah diatur."
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
