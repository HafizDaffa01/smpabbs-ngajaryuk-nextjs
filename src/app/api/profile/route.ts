import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone_num } = body

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return NextResponse.json(
        { error: 'Nama harus diisi' },
        { status: 400 }
      )
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email tidak valid' },
        { status: 400 }
      )
    }

    // Update profile in database
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        phone_num: phone_num || null,
      })
      .eq('id', user.id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Update email in Supabase Auth if changed
    if (email !== user.email) {
      const { error: authError } = await supabase.auth.updateUser({
        email: email.trim(),
      })

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 })
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

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
