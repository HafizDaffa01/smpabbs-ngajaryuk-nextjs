import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClient(request)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, is_admin')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
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
