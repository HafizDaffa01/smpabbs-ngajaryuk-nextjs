import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period')
    const year = searchParams.get('year')

    if (!period || !year) {
      return NextResponse.json(
        { error: 'Periode dan tahun harus diisi' },
        { status: 400 }
      )
    }

    // Parse period to get date range (21st-20th cycle)
    const [startMonth, endMonth] = period.split('-').map(Number)
    const startDate = `${year}-${String(startMonth).padStart(2, '0')}-21`
    const endDate = `${year}-${String(endMonth).padStart(2, '0')}-20`

    // Fetch teachers (non-admin profiles)
    const { data: teachers } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('is_admin', false)
      .order('name')

    if (!teachers || teachers.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data guru' }, { status: 404 })
    }

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

    // Build CSV
    const headers = ['Nama Guru', ...days.map((d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })), 'Total']
    const rows: string[][] = [headers]

    for (const teacher of teachers) {
      const row: string[] = [teacher.name]
      let total = 0

      for (const day of days) {
        const dayStart = `${day}T00:00:00`
        const dayEnd = `${day}T23:59:59`
        const record = absensis?.find(
          (a) => a.user_id === teacher.id && a.waktu >= dayStart && a.waktu <= dayEnd
        )
        const value = record?.value || 'A'
        row.push(value)
        if (value === 'S') total++
        else if (value === 'I') total += 0.5
        // A = 0
      }

      row.push(String(total))
      rows.push(row)
    }

    const csvContent = rows.map((row) => row.join(',')).join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=rekap_waktu_${period}_${year}.csv`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
