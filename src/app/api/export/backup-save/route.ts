import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { period, year, data } = body

    if (!period || !year || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Periode, tahun, dan data harus diisi' },
        { status: 400 }
      )
    }

    // Parse period to get date range (21st-20th cycle)
    const [startMonth, endMonth] = period.split('-').map(Number)
    const startDate = `${year}-${String(startMonth).padStart(2, '0')}-21`
    const endDate = `${year}-${String(endMonth).padStart(2, '0')}-20`

    // Upsert each attendance record
    for (const row of data) {
      const { user_id, date, value } = row

      if (!user_id || !date) continue

      // Check if record exists
      const { data: existing } = await supabase
        .from('absensis')
        .select('id')
        .eq('user_id', user_id)
        .gte('waktu', `${date}T00:00:00`)
        .lt('waktu', `${date}T23:59:59`)
        .maybeSingle()

      if (existing) {
        // Update existing
        await supabase
          .from('absensis')
          .update({ value })
          .eq('id', existing.id)
      } else {
        // Create new record with placeholder data
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user_id)
          .single()

        await supabase.from('absensis').insert({
          user_id,
          nama: profileData?.name || 'Unknown',
          unit: 'SMP ABBS Surakarta',
          lokasi: '-',
          alamat: '-',
          foto: null,
          akurasi: null,
          waktu: `${date}T00:00:00`,
          value,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
