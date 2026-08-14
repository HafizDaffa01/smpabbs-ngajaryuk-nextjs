import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff',
    },
  ],
})

const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
    fontSize: 10,
    padding: 20,
  },
  table: {
    flexDirection: 'column',
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    minHeight: 24,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  cell: {
    padding: 6,
    justifyContent: 'center',
  },
})

type AttendanceData = Record<number, Record<number, Record<number, string>>>

function RekapPresensiDocument({
  grade,
  semester,
  year,
  students,
  attendanceData,
  startMonth,
  endMonth,
}: {
  grade: string
  semester: number
  year: number
  students: { id: number; name: string }[]
  attendanceData: AttendanceData
  startMonth: number
  endMonth: number
}) {
  const months = Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>
          Rekap Presensi - Kelas {grade} - Semester {semester} - {year}
        </Text>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cell, { width: '15%' }]}>Nama Siswa</Text>
            {months.map((m) => (
              <Text key={m} style={[styles.cell, { width: `${70 / months.length}%`, textAlign: 'center' }]}>
                {new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'short' })}
              </Text>
            ))}
            <Text style={[styles.cell, { width: '15%', textAlign: 'center' }]}>Ringkasan</Text>
          </View>

          {students.map((student) => {
            const summary = { S: 0, I: 0, A: 0 }
            for (const m of months) {
              const monthData = attendanceData[student.id]?.[m] || {}
              for (const v of Object.values(monthData)) {
                if (v === 'S') summary.S++
                else if (v === 'I') summary.I++
                else if (v === 'A') summary.A++
              }
            }

            return (
              <View key={student.id} style={styles.tableRow}>
                <Text style={[styles.cell, { width: '15%' }]}>{student.name}</Text>
                {months.map((m) => {
                  const monthData = attendanceData[student.id]?.[m] || {}
                  const s = Object.values(monthData).filter((v) => v === 'S').length
                  const i = Object.values(monthData).filter((v) => v === 'I').length
                  const a = Object.values(monthData).filter((v) => v === 'A').length
                  return (
                    <Text key={m} style={[styles.cell, { width: `${70 / months.length}%`, textAlign: 'center' }]}>
                      {s > 0 ? `S:${s} ` : ''}
                      {i > 0 ? `I:${i} ` : ''}
                      {a > 0 ? `A:${a}` : ''}
                    </Text>
                  )
                })}
                <Text style={[styles.cell, { width: '15%', textAlign: 'center' }]}>
                  S:{summary.S} I:{summary.I} A:{summary.A}
                </Text>
              </View>
            )
          })}
        </View>
      </Page>
    </Document>
  )
}

export async function GET(request: NextRequest) {
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

  const searchParams = request.nextUrl.searchParams
  const grade = (searchParams.get('class') ?? '').toUpperCase()
  const semester = searchParams.get('semester') ? parseInt(searchParams.get('semester')!) : new Date().getMonth() <= 6 ? 1 : 2
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

  if (!grade || !semester || !year) {
    return NextResponse.json(
      { error: 'Kelas, semester, dan tahun harus diisi' },
      { status: 400 }
    )
  }

  const startMonthBound = semester === 1 ? 1 : 7
  const endMonthBound = semester === 1 ? 6 : 12

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

  const studentIds = students.map((s) => s.id)

  const { data: attendances } = await supabase
    .from('attendances')
    .select('*')
    .in('student_id', studentIds)
    .eq('year', year)
    .gte('month', startMonthBound)
    .lte('month', endMonthBound)

  const attendanceData: AttendanceData = {}
  for (const att of attendances ?? []) {
    if (!attendanceData[att.student_id]) {
      attendanceData[att.student_id] = {}
    }
    if (!attendanceData[att.student_id][att.month]) {
      attendanceData[att.student_id][att.month] = {}
    }
    attendanceData[att.student_id][att.month][att.day] = att.value
  }

  const element = (
    <RekapPresensiDocument
      grade={grade}
      semester={semester}
      year={year}
      students={students}
      attendanceData={attendanceData}
      startMonth={startMonthBound}
      endMonth={endMonthBound}
    />
  )

  try {
    const pdfBuffer = await renderToBuffer(element)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=rekap_presensi_kelas_${grade}_semester_${semester}_${year}.pdf`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
