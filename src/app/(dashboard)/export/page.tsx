import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Filter } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import BackupClient, { ExportTargets } from './backup-client'

export const metadata = {
  title: 'Backup & Export',
  description: 'Export dan backup data',
}

export const dynamic = 'force-dynamic'

const PERIODS = [
  { value: '1-2', label: 'Periode 1 (21 Jan - 20 Feb)' },
  { value: '2-3', label: 'Periode 2 (21 Feb - 20 Mar)' },
  { value: '3-4', label: 'Periode 3 (21 Mar - 20 Apr)' },
  { value: '4-5', label: 'Periode 4 (21 Apr - 20 Mei)' },
  { value: '5-6', label: 'Periode 5 (21 Mei - 20 Jun)' },
  { value: '6-7', label: 'Periode 6 (21 Jun - 20 Jul)' },
  { value: '7-8', label: 'Periode 7 (21 Jul - 20 Ags)' },
  { value: '8-9', label: 'Periode 8 (21 Ags - 20 Sep)' },
  { value: '9-10', label: 'Periode 9 (21 Sep - 20 Okt)' },
  { value: '10-11', label: 'Periode 10 (21 Okt - 20 Nov)' },
  { value: '11-12', label: 'Periode 11 (21 Nov - 20 Des)' },
  { value: '12-1', label: 'Periode 12 (21 Des - 20 Jan)' },
]

const DATA_TYPES = [
  { value: 'waktu', label: 'Waktu' },
  { value: 'lokasi', label: 'Lokasi' },
  { value: 'gambar', label: 'Gambar' },
]

export default async function BackupPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; year?: string; type?: string; search?: string }>
}) {
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

  const params = await searchParams
  const selectedPeriod = params.period || '1-2'
  const selectedYear = params.year || String(new Date().getFullYear())
  const selectedType = params.type || 'waktu'
  const searchQuery = params.search || ''

  // Fetch teachers
  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('is_admin', false)
    .order('name')

  // Fetch years from absensis
  const { data: yearData } = await supabase
    .from('absensis')
    .select('waktu')
    .order('waktu', { ascending: false })
    .limit(1000)

  const years = [...new Set(yearData?.map((a) => new Date(a.waktu).getFullYear()) || [])]
  const currentYear = new Date().getFullYear()
  if (!years.includes(currentYear)) years.unshift(currentYear)

  // Parse period to get date range
  const [startMonth, endMonth] = selectedPeriod.split('-').map(Number)
  const startDate = `${selectedYear}-${String(startMonth).padStart(2, '0')}-21`
  const endDate = `${selectedYear}-${String(endMonth).padStart(2, '0')}-20`

  // Generate days in the period
  const days: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)
  while (current <= end) {
    days.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  // Fetch attendance for the period
  const { data: absensis } = await supabase
    .from('absensis')
    .select('*')
    .gte('waktu', startDate)
    .lte('waktu', `${endDate}T23:59:59`)
    .order('waktu')

  // Build attendance map: [user_id][date] = record
  type AbsensiRecord = {
    id: number
    user_id: string
    nama: string
    unit: string
    lokasi: string
    alamat: string | null
    foto: string | null
    akurasi: string | null
    waktu: string
    value?: string
  }
  const attendanceMap = new Map<string, Map<string, AbsensiRecord>>()
  for (const absen of absensis ?? []) {
    const dateKey = absen.waktu.split('T')[0]
    if (!attendanceMap.has(absen.user_id)) {
      attendanceMap.set(absen.user_id, new Map())
    }
    attendanceMap.get(absen.user_id)!.set(dateKey, absen as AbsensiRecord)
  }

  // Filter teachers by search
  const filteredTeachers = teachers?.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const periodLabel =
    PERIODS.find((p) => p.value === selectedPeriod)?.label ?? `Periode ${selectedPeriod}`
  const typeLabel =
    DATA_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Backup & Export Data"
        crumbs={[{ label: 'Beranda', href: '/' }, { label: 'Backup & Export' }]}
        description="Pilih periode dan tipe data, periksa hasilnya, lalu simpan ulang atau unduh sebagai arsip."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="accent">{periodLabel}</Badge>
            <Badge variant="neutral">{selectedYear}</Badge>
            <Badge variant="info">{typeLabel}</Badge>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Cakupan data</CardTitle>
            <CardDescription>
              Filter menentukan periode, tahun, dan tipe data yang ditampilkan sekaligus di
              bawah ini.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form
            id="filterForm"
            action="/export"
            method="GET"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="period">Periode</Label>
              <Select id="period" name="period" defaultValue={selectedPeriod}>
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="year">Tahun</Label>
              <Select id="year" name="year" defaultValue={selectedYear}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Tipe Data</Label>
              <Select id="type" name="type" defaultValue={selectedType}>
                {DATA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="search">Cari Guru</Label>
              <Input
                id="search"
                name="search"
                type="text"
                defaultValue={searchQuery}
                placeholder="Nama guru..."
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full xl:w-auto">
                <Filter aria-hidden className="size-4" />
                Filter
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Export targets */}
      <ExportTargets period={selectedPeriod} year={selectedYear} periodLabel={periodLabel} />

      {/* Data grid */}
      <BackupClient
        teachers={filteredTeachers}
        days={days}
        attendanceMap={attendanceMap}
        period={selectedPeriod}
        year={selectedYear}
        dataType={selectedType}
      />
    </div>
  )
}

