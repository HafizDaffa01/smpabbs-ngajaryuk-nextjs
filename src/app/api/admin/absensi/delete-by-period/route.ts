import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { month, year, with_image } = await request.json()

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Bulan dan tahun harus diisi' },
        { status: 400 }
      )
    }

    const { data: absensis } = await supabase
      .from('absensis')
      .select('foto')
      .eq('month', month)
      .eq('year', year)

    if (with_image && absensis) {
      const paths = absensis
        .map((a) => a.foto?.split('/').pop())
        .filter((p): p is string => !!p)

      if (paths.length > 0) {
        await supabase.storage.from('uploads').remove(paths)
      }
    }

    const { error } = await supabase
      .from('absensis')
      .delete()
      .eq('month', month)
      .eq('year', year)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
