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

interface RekapPresensiPDFProps {
  grade: string
  semester: number
  year: number
  students: { id: number; name: string }[]
  attendanceData: Record<number, Record<number, Record<number, string>>>
  startMonth: number
  endMonth: number
}

export default function RekapPresensiPDF({
  grade,
  semester,
  year,
  students,
  attendanceData,
  startMonth,
  endMonth,
}: RekapPresensiPDFProps) {
  const months = Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i)

  return (
    <PDFDownloadLink
      document={
        <Document>
          <Page size="A4" orientation="landscape" style={styles.page}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>
              Rekap Presensi - Kelas {grade} - Semester {semester} - {year}
            </Text>

            <View style={styles.table}>
              {/* Header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.cell, { width: '15%' }]}>Nama Siswa</Text>
                {months.map((m) => (
                  <Text key={m} style={[styles.cell, { width: `${70 / months.length}%`, textAlign: 'center' }]}>
                    {new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'short' })}
                  </Text>
                ))}
                <Text style={[styles.cell, { width: '15%', textAlign: 'center' }]}>Ringkasan</Text>
              </View>

              {/* Rows */}
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
      }
      fileName={`rekap_presensi_kelas_${grade}_semester_${semester}_${year}.pdf`}
    >
      {({ loading }) => (loading ? 'Membuat PDF...' : 'Download PDF')}
    </PDFDownloadLink>
  )
}
