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

    const withImage = request.nextUrl.searchParams.get('with_image') === '1'

    if (withImage) {
      const { data: absensis } = await supabase.from('absensis').select('foto')

      if (absensis) {
        const paths = absensis
          .map((a) => a.foto?.split('/').pop())
          .filter((p): p is string => !!p)

        if (paths.length > 0) {
          await supabase.storage.from('uploads').remove(paths)
        }
      }
    }

    const { error } = await supabase.from('absensis').delete().neq('id', 0)

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
