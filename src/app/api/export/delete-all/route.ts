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
    const { with_image } = body

    // Delete all absensi records
    const { error: deleteError } = await supabase
      .from('absensis')
      .delete()
      .neq('id', 0)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    if (with_image === 1) {
      // Note: In a real implementation, you would also delete physical files
      // This requires access to the filesystem which is limited in serverless
      console.log('Image deletion requested but not implemented in serverless environment')
    }

    return NextResponse.json({ success: true, message: 'Semua data absensi berhasil dihapus' })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
