import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    backgroundColor: '#f3f4f6',
    padding: 4,
  },
  note: {
    marginBottom: 8,
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
})

function RekapKBMDocument({
  grade,
  semester,
  year,
  kbmByDate,
}: {
  grade: string
  semester: number
  year: number
  kbmByDate: Map<string, { date: string; subject: string; time: string; note: string }[]>
}) {
  const dates = Array.from(kbmByDate.keys()).sort()

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>
          Rekap KBM - Kelas {grade} - Semester {semester} - {year}
        </Text>

        {dates.map((date) => {
          const notes = kbmByDate.get(date) || []
          const dateObj = new Date(date + 'T00:00:00')
          const formattedDate = dateObj.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })

          return (
            <View key={date} style={styles.section}>
              <Text style={styles.sectionTitle}>{formattedDate}</Text>
              {notes.map((note, idx) => (
                <View key={idx} style={styles.note}>
                  <Text>
                    {note.subject} - {note.time}
                  </Text>
                  <Text>{note.note}</Text>
                </View>
              ))}
            </View>
          )
        })}
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

  const startMonth = semester === 1 ? 1 : 7
  const endMonth = semester === 1 ? 6 : 12
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${endMonth === 6 ? '30' : '31'}`

  const { data: kbmData } = await supabase
    .from('notes')
    .select('*')
    .eq('class', grade)
    .gte('date', startDate)
    .lte('date', endDate)

  const kbmByDate = new Map<string, { date: string; subject: string; time: string; note: string }[]>()
  for (const note of kbmData ?? []) {
    const existing = kbmByDate.get(note.date) ?? []
    existing.push({
      date: note.date,
      subject: note.subject,
      time: note.time,
      note: note.note,
    })
    kbmByDate.set(note.date, existing)
  }

  const element = (
    <RekapKBMDocument
      grade={grade}
      semester={semester}
      year={year}
      kbmByDate={kbmByDate}
    />
  )

  try {
    const pdfBuffer = await renderToBuffer(element)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=rekap_kbm_kelas_${grade}_semester_${semester}_${year}.pdf`,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
