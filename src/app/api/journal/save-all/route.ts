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

    const { month, year, attendance, kbm } = await request.json()

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Bulan dan tahun harus diisi' },
        { status: 400 }
      )
    }

    const classParam = request.nextUrl.searchParams.get('class')
    if (!classParam) {
      return NextResponse.json({ error: 'Kelas harus diisi' }, { status: 400 })
    }

    // Save attendance
    if (attendance && Array.isArray(attendance)) {
      for (const r of attendance) {
        const { error } = await supabase.from('attendances').upsert(
          {
            student_id: r.student_id,
            day: r.day,
            month,
            year,
            value: r.value,
          },
          { onConflict: 'student_id,day,month,year' }
        )

        if (error) {
          console.error('Attendance save error:', error)
          return NextResponse.json(
            { error: 'Gagal menyimpan absensi' },
            { status: 500 }
          )
        }
      }
    }

    // Save KBM notes
    if (kbm && Array.isArray(kbm)) {
      for (const k of kbm) {
        if (!k.subject || !k.date || !k.time || !k.note) continue

        const { error } = await supabase.from('notes').upsert(
          {
            class: classParam,
            subject: k.subject,
            date: k.date,
            time: k.time,
            note: k.note,
            checked: true,
            teacher_id: k.teacher_id ?? session.user.id,
          },
          { onConflict: 'class,subject,date' }
        )

        if (error) {
          console.error('Note save error:', error)
          return NextResponse.json(
            { error: 'Gagal menyimpan catatan KBM' },
            { status: 500 }
          )
        }
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
