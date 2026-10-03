'use client'

import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

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
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
    fontSize: 9,
    padding: 15,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    backgroundColor: '#f3f4f6',
    padding: 4,
  },
  scheduleRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    paddingVertical: 3,
  },
  note: {
    marginBottom: 6,
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 6,
    marginTop: 4,
    borderRadius: 4,
  },
})

interface RekapKBMPDFProps {
  grade: string
  semester: number
  year: number
  kbmByDate: Map<string, { date: string; subject: string; time: string; note: string; teacher?: string }[]>
  schedules?: { day: string; period: number; subject: string; teacher: string | null; start_time: string | null; end_time: string | null }[]
}

export default function RekapKBMPDF({ grade, semester, year, kbmByDate, schedules = [] }: RekapKBMPDFProps) {
  const dates = Array.from(kbmByDate.keys()).sort()

  // Group schedules by day
  const schedulesByDay = new Map<string, typeof schedules>()
  for (const sched of schedules) {
    const existing = schedulesByDay.get(sched.day) || []
    existing.push(sched)
    schedulesByDay.set(sched.day, existing)
  }

  return (
    <PDFDownloadLink
      document={
        <Document>
          <Page size="A4" orientation="landscape" style={styles.page}>
            <Text style={styles.title}>
              Rekap KBM - Kelas {grade} - Semester {semester} - Tahun {year}
            </Text>

            {/* Schedule Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Jadwal Pelajaran</Text>
              {Array.from(schedulesByDay.entries()).map(([day, daySchedules]) => (
                <View key={day} style={styles.scheduleRow}>
                  <Text style={{ width: '15%', fontSize: 8 }}>{day}</Text>
                  {daySchedules.map((sched, idx) => (
                    <Text key={idx} style={{ width: '85%', fontSize: 8, paddingHorizontal: 4 }}>
                      Jam {sched.period}: {sched.subject} {sched.teacher ? `- ${sched.teacher}` : ''}
                      {sched.start_time && sched.end_time ? ` (${sched.start_time}-${sched.end_time})` : ''}
                    </Text>
                  ))}
                </View>
              ))}
              {schedulesByDay.size === 0 && (
                <Text style={{ fontSize: 8, color: '#6b7280' }}>Tidak ada jadwal</Text>
              )}
            </View>

            {/* KBM Notes by Date */}
            {dates.map((date) => {
              const notes = kbmByDate.get(date) || []
              const dateObj = new Date(date + 'T00:00:00')
              const formattedDate = dateObj.toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })

              // Count attendance for this date
              const presentCount = notes.filter((n) => n.note && n.note.trim()).length

              return (
                <View key={date} style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {formattedDate} ({presentCount} catatan)
                  </Text>
                  {notes.map((note, idx) => (
                    <View key={idx} style={styles.note}>
                      <Text style={{ fontSize: 8, fontWeight: 'bold' }}>
                        {note.subject} - {note.time}
                        {note.teacher ? ` (${note.teacher})` : ''}
                      </Text>
                      <Text style={{ fontSize: 8 }}>{note.note}</Text>
                    </View>
                  ))}
                  {notes.length === 0 && (
                    <Text style={{ fontSize: 8, color: '#6b7280', padding: 4 }}>
                      Tidak ada catatan KBM
                    </Text>
                  )}
                </View>
              )
            })}

            {dates.length === 0 && (
              <View style={styles.section}>
                <Text style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', marginTop: 20 }}>
                  Tidak ada data KBM untuk periode ini.
                </Text>
              </View>
            )}
          </Page>
        </Document>
      }
      fileName={`rekap_kbm_kelas_${grade}_semester_${semester}_${year}.pdf`}
    >
      {({ loading }) => (loading ? 'Membuat PDF...' : 'Download PDF')}
    </PDFDownloadLink>
  )
}
