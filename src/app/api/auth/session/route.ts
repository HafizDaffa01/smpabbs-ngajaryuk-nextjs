import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClient(request)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, is_admin')
      .eq('id', session.user.id)
      .single()

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: profile?.name,
        is_admin: profile?.is_admin ?? false,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
