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
    const year = searchParams.get('year')

    if (!year) {
      return NextResponse.json(
        { error: 'Tahun harus diisi' },
        { status: 400 }
      )
    }

    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    // Fetch all attendance records for the year
    const { data: absensis } = await supabase
      .from('absensis')
      .select('*')
      .gte('waktu', startDate)
      .lte('waktu', `${endDate}T23:59:59`)
      .order('waktu')

    if (!absensis || absensis.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data' }, { status: 404 })
    }

    // Build CSV with GPS + address
    const headers = ['ID', 'Nama', 'Unit', 'Lokasi (GPS)', 'Alamat', 'Waktu', 'Akurasi']
    const rows = absensis.map((a) => [
      a.id,
      a.nama,
      a.unit,
      a.lokasi || '',
      a.alamat || '',
      a.waktu,
      a.akurasi || '',
    ])

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=rekap_lokasi_${year}.csv`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
