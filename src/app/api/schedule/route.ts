import { createClient } from '@/utils/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClient(request)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const classParam = searchParams.get('class')
    const dayParam = searchParams.get('day')

    let query = supabase.from('schedules').select('*').order('class_name').order('day').order('period')

    if (classParam) {
      query = query.eq('class_name', classParam)
    }
    if (dayParam) {
      query = query.eq('day', dayParam)
    }

    const { data: schedules, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ schedules })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase } = createClient(request)

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
    const { class_name, day, period, subject, subject_display, teacher, start_time, end_time } = body

    if (!class_name || !day || !period || !subject) {
      return NextResponse.json(
        { error: 'Kelas, hari, periode, dan mapel harus diisi' },
        { status: 400 }
      )
    }

    const { data: schedule, error } = await supabase
      .from('schedules')
      .insert({
        class_name,
        day,
        period,
        subject,
        subject_display: subject_display || subject.toUpperCase(),
        teacher: teacher || null,
        start_time: start_time || null,
        end_time: end_time || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ schedule })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
