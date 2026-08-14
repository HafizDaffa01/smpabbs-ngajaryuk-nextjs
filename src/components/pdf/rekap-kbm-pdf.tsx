'use client'

import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

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

interface RekapKBMPDFProps {
  grade: string
  semester: number
  year: number
  kbmByDate: Map<string, { date: string; subject: string; time: string; note: string }[]>
}

export default function RekapKBMPDF({ grade, semester, year, kbmByDate }: RekapKBMPDFProps) {
  const dates = Array.from(kbmByDate.keys()).sort()

  return (
    <PDFDownloadLink
      document={
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
      }
      fileName={`rekap_kbm_kelas_${grade}_semester_${semester}_${year}.pdf`}
    >
      {({ loading }) => (loading ? 'Membuat PDF...' : 'Download PDF')}
    </PDFDownloadLink>
  )
}
