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
    const { month, year, with_image } = body

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Bulan dan tahun harus diisi' },
        { status: 400 }
      )
    }

    // Parse month/year to date range
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`

    // Delete absensi records for the period
    const { error: deleteError } = await supabase
      .from('absensis')
      .delete()
      .gte('waktu', startDate)
      .lte('waktu', `${endDate}T23:59:59`)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    if (with_image === 1) {
      // Note: In a real implementation, you would also delete physical files
      console.log('Image deletion requested but not implemented in serverless environment')
    }

    return NextResponse.json({ 
      success: true, 
      message: `Data absensi bulan ${month}/${year} berhasil dihapus` 
    })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
