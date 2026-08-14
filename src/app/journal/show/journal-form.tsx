'use client'

import { useState } from 'react'

type Student = {
  id: number
  name: string
  grade: string
}

type Schedule = {
  id: number
  class_name: string
  day: string
  period: number
  subject: string
  subject_display: string
  teacher: string | null
  start_time: string | null
  end_time: string | null
}

type Note = {
  id: number
  class: string
  subject: string
  teacher_id: string | null
  date: string
  time: string
  note: string
  checked: boolean
}

type AttendanceMap = Record<string, Record<number, string>>
type SummaryMap = Record<number, { S: number; I: number; A: number }>
type NoteIndexed = Record<string, Note>

interface JournalFormProps {
  grade: string
  day: number
  month: number
  year: number
  students: Student[]
  mapelList: Record<string, string[]>
  attendanceMap: AttendanceMap
  summaryMap: SummaryMap
  noteList: Note[]
  noteIndexed: NoteIndexed
  schedules: Schedule[]
}

export default function JournalForm({
  grade,
  day,
  month,
  year,
  students,
  mapelList,
  attendanceMap,
  summaryMap,
  noteList,
  noteIndexed,
  schedules,
}: JournalFormProps) {
  const [selectedDay, setSelectedDay] = useState(day)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [localAttendanceMap, setLocalAttendanceMap] = useState<AttendanceMap>(attendanceMap)
  const [localNoteIndexed, setLocalNoteIndexed] = useState<NoteIndexed>(noteIndexed)

  const daysInMonth = new Date(year, month, 0).getDate()

  async function handleSaveAll() {
    setLoading(true)
    setMessage(null)

    try {
      // Collect attendance data
      const attendanceData: {
        student_id: number
        day: number
        value: string
      }[] = []

      for (const student of students) {
        const studentAtt = localAttendanceMap[String(student.id)]
        if (studentAtt && studentAtt[selectedDay]) {
          attendanceData.push({
            student_id: student.id,
            day: selectedDay,
            value: studentAtt[selectedDay],
          })
        }
      }

      // Collect KBM data
      const kbmData: {
        subject: string
        date: string
        time: string
        note: string
        teacher_id?: string
      }[] = []

      for (const note of noteList) {
        if (note.note.trim()) {
          kbmData.push({
            subject: note.subject,
            date: note.date,
            time: note.time,
            note: note.note,
            teacher_id: note.teacher_id ?? undefined,
          })
        }
      }

      const response = await fetch(`/api/journal/save-all?class=${encodeURIComponent(grade)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month,
          year,
          attendance: attendanceData,
          kbm: kbmData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan data')
      }

      setMessage({ type: 'success', text: 'Data berhasil disimpan!' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveNote(subject: string) {
    const note = localNoteIndexed[subject]
    if (!note) return

    try {
      const response = await fetch('/api/journal/save-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          class: grade,
          subject: note.subject,
          teacher_id: note.teacher_id,
          date: note.date,
          time: note.time,
          note: note.note,
          checked: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan catatan')
      }
    } catch (err) {
      console.error('Save note error:', err)
    }
  }

  function updateAttendance(studentId: number, value: 'S' | 'I' | 'A' | '') {
    setLocalAttendanceMap((prev) => {
      const newMap = { ...prev }
      const studentAtt = { ...(newMap[String(studentId)] || {}) }
      if (value) {
        studentAtt[selectedDay] = value
      } else {
        delete studentAtt[selectedDay]
      }
      newMap[String(studentId)] = studentAtt
      return newMap
    })
  }

  function updateNote(subject: string, field: string, value: string) {
    setLocalNoteIndexed((prev) => {
      const newMap = { ...prev }
      const existing = newMap[subject]
      if (existing) {
        newMap[subject] = { ...existing, [field]: value } as Note
      } else {
        newMap[subject] = {
          id: 0,
          class: grade,
          subject,
          teacher_id: null,
          date: `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`,
          time: new Date().toTimeString().slice(0, 5),
          note: '',
          checked: false,
          [field]: value,
        } as Note
      }
      return newMap
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Date picker */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label htmlFor="day" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Tanggal
          </label>
          <select
            id="day"
            value={selectedDay}
            onChange={(e) => setSelectedDay(parseInt(e.target.value))}
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="month" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Bulan
          </label>
          <input
            type="text"
            value={month}
            readOnly
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="year" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Tahun
          </label>
          <input
            type="text"
            value={year}
            readOnly
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Attendance Section */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Absensi Siswa - Tanggal {selectedDay}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-700">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800">
                <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  Nama Siswa
                </th>
                <th className="border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  S
                </th>
                <th className="border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  I
                </th>
                <th className="border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  A
                </th>
                <th className="border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  Ringkasan
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const studentAtt = localAttendanceMap[String(student.id)] || {}
                const currentValue = studentAtt[selectedDay] || ''
                const summary = summaryMap[student.id] || { S: 0, I: 0, A: 0 }

                return (
                  <tr key={student.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      {student.name}
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-center dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => updateAttendance(student.id, 'S')}
                        className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                          currentValue === 'S'
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-200 text-zinc-700 hover:bg-blue-100 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-blue-900/30'
                        }`}
                      >
                        S
                      </button>
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-center dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => updateAttendance(student.id, 'I')}
                        className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                          currentValue === 'I'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-zinc-200 text-zinc-700 hover:bg-yellow-100 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-yellow-900/30'
                        }`}
                      >
                        I
                      </button>
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-center dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => updateAttendance(student.id, 'A')}
                        className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                          currentValue === 'A'
                            ? 'bg-red-600 text-white'
                            : 'bg-zinc-200 text-zinc-700 hover:bg-red-100 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-red-900/30'
                        }`}
                      >
                        A
                      </button>
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-center text-sm dark:border-zinc-700">
                      <span className="text-blue-600 dark:text-blue-400">S: {summary.S}</span>
                      {' | '}
                      <span className="text-yellow-600 dark:text-yellow-400">I: {summary.I}</span>
                      {' | '}
                      <span className="text-red-600 dark:text-red-400">A: {summary.A}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* KBM Notes Section */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Jurnal KBM
        </h2>
        <div className="flex flex-col gap-4">
          {Object.entries(mapelList).map(([subject, teacherNames]) => (
            <div key={subject} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-50">
                {subject}
              </h3>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                Guru: {teacherNames.join(', ')}
              </p>
              <textarea
                value={localNoteIndexed[subject]?.note || ''}
                onChange={(e) => updateNote(subject, 'note', e.target.value)}
                placeholder="Masukkan catatan KBM..."
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white dark:focus:ring-white"
                rows={3}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveNote(subject)}
                  className="rounded-md bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                >
                  Simpan Catatan
                </button>
              </div>
            </div>
          ))}
          {Object.keys(mapelList).length === 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tidak ada jadwal untuk hari ini.
            </p>
          )}
        </div>
      </div>

      {/* Save All Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={loading}
          className="rounded-md bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>
    </div>
  )
}
