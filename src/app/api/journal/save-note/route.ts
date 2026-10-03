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

    const { class: className, subject, teacher_id, date, time, note, checked } = await request.json()

    if (!className || !subject || !date || !time || !note) {
      return NextResponse.json(
        { error: 'Data tidak lengkap' },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('notes').upsert(
      {
        class: className,
        subject,
        date,
        time,
        note,
        checked: checked ?? true,
        teacher_id: teacher_id ?? user.id,
      },
      { onConflict: 'class,subject,date' }
    )

    if (error) {
      console.error('Note save error:', error)
      return NextResponse.json(
        { error: 'Gagal menyimpan catatan' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
