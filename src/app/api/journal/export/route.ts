import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const grade = searchParams.get('class')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    if (!grade || !month || !year) {
      return NextResponse.json(
        { error: 'Kelas, bulan, dan tahun harus diisi' },
        { status: 400 }
      )
    }

    const xlsx = await import('xlsx')

    // Fetch students
    let studentsQuery = supabase.from('students').select('*').order('name')
    if (['7', '8', '9'].includes(grade)) {
      studentsQuery = studentsQuery.ilike('grade', `${grade}%`)
    } else {
      studentsQuery = studentsQuery.eq('grade', grade)
    }
    const { data: students } = await studentsQuery

    if (!students || students.length === 0) {
      return NextResponse.json({ error: 'Tidak ada siswa di kelas ini' }, { status: 404 })
    }

    // Fetch attendance
    const studentIds = students.map((s) => s.id)
    const { data: attendance } = await supabase
      .from('attendances')
      .select('*')
      .in('student_id', studentIds)
      .eq('month', parseInt(month))
      .eq('year', parseInt(year))

    // Fetch notes for the month
    const monthStr = String(parseInt(month)).padStart(2, '0')
    const { data: notes } = await supabase
      .from('notes')
      .select('*')
      .eq('class', grade)
      .gte('date', `${year}-${monthStr}-01`)
      .lte('date', `${year}-${monthStr}-31`)

    // Build workbook
    const wb = xlsx.utils.book_new()

    // Attendance sheet
    const attendanceData = [
      ['Nama Siswa', ...Array.from({ length: 31 }, (_, i) => i + 1), 'S', 'I', 'A'],
    ]

    for (const student of students) {
      const studentAttendance = attendance?.filter((a) => a.student_id === student.id) || []
      const row = [student.name]
      const summary = { S: 0, I: 0, A: 0 }

      for (let d = 1; d <= 31; d++) {
        const att = studentAttendance.find((a) => a.day === d)
        row.push(att?.value || '')
        if (att?.value === 'S') summary.S++
        else if (att?.value === 'I') summary.I++
        else if (att?.value === 'A') summary.A++
      }

      row.push(summary.S, summary.I, summary.A)
      attendanceData.push(row)
    }

    const ws1 = xlsx.utils.aoa_to_sheet(attendanceData)
    xlsx.utils.book_append_sheet(wb, ws1, 'Absensi')

    // KBM sheet
    const kbmData = [
      ['Tanggal', 'Mapel', 'Guru', 'Catatan'],
    ]

    for (const note of notes ?? []) {
      kbmData.push([note.date, note.subject, note.teacher_id || '-', note.note])
    }

    const ws2 = xlsx.utils.aoa_to_sheet(kbmData)
    xlsx.utils.book_append_sheet(wb, ws2, 'KBM')

    // Generate buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=jurnal_kelas_${grade}_${month}_${year}.xlsx`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
