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
    fontSize: 9,
    padding: 15,
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
    minHeight: 20,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  cell: {
    padding: 4,
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderTopWidth: 2,
    borderTopColor: '#000000',
    minHeight: 20,
    alignItems: 'center',
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

  // Calculate grand totals
  const grandTotals = { S: 0, I: 0, A: 0 }
  for (const student of students) {
    for (const m of months) {
      const monthData = attendanceData[student.id]?.[m] || {}
      for (const v of Object.values(monthData)) {
        if (v === 'S') grandTotals.S++
        else if (v === 'I') grandTotals.I++
        else if (v === 'A') grandTotals.A++
      }
    }
  }

  return (
    <PDFDownloadLink
      document={
        <Document>
          <Page size="A4" orientation="landscape" style={styles.page}>
            <Text style={styles.title}>
              Rekap Presensi - Kelas {grade} - Semester {semester} - Tahun {year}
            </Text>

            <View style={styles.table}>
              {/* Header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.cell, { width: '12%' }]}>Nama Siswa</Text>
                {months.map((m) => (
                  <Text
                    key={m}
                    style={[
                      styles.cell,
                      { width: `${78 / months.length}%`, textAlign: 'center', fontSize: 8 },
                    ]}
                  >
                    {new Date(year, m - 1).toLocaleDateString('id-ID', { month: 'short' })}
                  </Text>
                ))}
                <Text style={[styles.cell, { width: '10%', textAlign: 'center' }]}>S</Text>
                <Text style={[styles.cell, { width: '10%', textAlign: 'center' }]}>I</Text>
                <Text style={[styles.cell, { width: '10%', textAlign: 'center' }]}>A</Text>
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
                    <Text style={[styles.cell, { width: '12%' }]}>{student.name}</Text>
                    {months.map((m) => {
                      const monthData = attendanceData[student.id]?.[m] || {}
                      const s = Object.values(monthData).filter((v) => v === 'S').length
                      const i = Object.values(monthData).filter((v) => v === 'I').length
                      const a = Object.values(monthData).filter((v) => v === 'A').length
                      return (
                        <Text
                          key={m}
                          style={[
                            styles.cell,
                            { width: `${78 / months.length}%`, textAlign: 'center', fontSize: 8 },
                          ]}
                        >
                          {s > 0 ? `S:${s} ` : ''}
                          {i > 0 ? `I:${i} ` : ''}
                          {a > 0 ? `A:${a}` : ''}
                        </Text>
                      )
                    })}
                    <Text style={[styles.cell, { width: '10%', textAlign: 'center', fontSize: 8 }]}>
                      {summary.S}
                    </Text>
                    <Text style={[styles.cell, { width: '10%', textAlign: 'center', fontSize: 8 }]}>
                      {summary.I}
                    </Text>
                    <Text style={[styles.cell, { width: '10%', textAlign: 'center', fontSize: 8 }]}>
                      {summary.A}
                    </Text>
                  </View>
                )
              })}

              {/* Grand Total Row */}
              <View style={styles.summaryRow}>
                <Text style={[styles.cell, { width: '12%', fontWeight: 'bold' }]}>Total</Text>
                {months.map((m) => {
                  let monthS = 0,
                    monthI = 0,
                    monthA = 0
                  for (const student of students) {
                    const monthData = attendanceData[student.id]?.[m] || {}
                    monthS += Object.values(monthData).filter((v) => v === 'S').length
                    monthI += Object.values(monthData).filter((v) => v === 'I').length
                    monthA += Object.values(monthData).filter((v) => v === 'A').length
                  }
                  return (
                    <Text
                      key={m}
                      style={[
                        styles.cell,
                        { width: `${78 / months.length}%`, textAlign: 'center', fontSize: 8 },
                      ]}
                    >
                      {monthS > 0 ? `S:${monthS} ` : ''}
                      {monthI > 0 ? `I:${monthI} ` : ''}
                      {monthA > 0 ? `A:${monthA}` : ''}
                    </Text>
                  )
                })}
                <Text style={[styles.cell, { width: '10%', textAlign: 'center', fontWeight: 'bold', fontSize: 8 }]}>
                  {grandTotals.S}
                </Text>
                <Text style={[styles.cell, { width: '10%', textAlign: 'center', fontWeight: 'bold', fontSize: 8 }]}>
                  {grandTotals.I}
                </Text>
                <Text style={[styles.cell, { width: '10%', textAlign: 'center', fontWeight: 'bold', fontSize: 8 }]}>
                  {grandTotals.A}
                </Text>
              </View>
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
