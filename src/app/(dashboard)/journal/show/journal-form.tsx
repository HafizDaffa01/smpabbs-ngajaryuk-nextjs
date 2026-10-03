'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
  ChevronDown,
  CheckSquare,
  BookOpen,
} from 'lucide-react'
import Flatpickr from 'flatpickr'
import 'flatpickr/dist/themes/airbnb.css'
import 'flatpickr/dist/l10n/id.js'
import AttendanceGrid from '@/components/attendance-grid'
import KbmEditor from '@/components/kbm-editor'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { FeedbackBanner } from '@/components/ui/feedback-banner'

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
type NoteIndexedAll = Record<string, Note>

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
  noteIndexedAll: NoteIndexedAll
  schedules: Schedule[]
  isAdmin: boolean
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
  noteIndexed,
  noteIndexedAll,
  schedules,
  isAdmin,
}: JournalFormProps) {
  const [selectedDay, setSelectedDay] = useState(day)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [localAttendanceMap, setLocalAttendanceMap] = useState<AttendanceMap>(attendanceMap)
  const [localNoteIndexed, setLocalNoteIndexed] = useState<NoteIndexed>(noteIndexed)
  const [localNoteIndexedAll, setLocalNoteIndexedAll] = useState<NoteIndexedAll>(noteIndexedAll)
  const [teachersExpanded, setTeachersExpanded] = useState(true)
  const [kbmExpanded, setKbmExpanded] = useState(true)
  const [attendanceExpanded, setAttendanceExpanded] = useState(true)
  const [allExpanded, setAllExpanded] = useState(true)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const flatpickrRef = useRef<Flatpickr.Instance | null>(null)

  const handleExpandAll = () => {
    setTeachersExpanded(true)
    setKbmExpanded(true)
    setAttendanceExpanded(true)
    setAllExpanded(true)
  }

  const handleCollapseAll = () => {
    setTeachersExpanded(false)
    setKbmExpanded(false)
    setAttendanceExpanded(false)
    setAllExpanded(false)
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()

  // Initialize flatpickr
  useEffect(() => {
    if (dateInputRef.current && !flatpickrRef.current) {
      flatpickrRef.current = Flatpickr(dateInputRef.current, {
        dateFormat: 'd/m/Y',
        defaultDate: `${day}/${month}/${year}`,
        locale: 'id',
        allowInput: true,
        onChange: (selectedDates) => {
          if (selectedDates[0]) {
            const d = selectedDates[0]
            setSelectedDay(d.getDate())
          }
        },
      })
    }

    return () => {
      if (flatpickrRef.current) {
        flatpickrRef.current.destroy()
        flatpickrRef.current = null
      }
    }
  }, [day, month, year])

  // Update local note indexed when selected day changes
  useEffect(() => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    const dayNotes: NoteIndexed = {}
    for (const [key, note] of Object.entries(localNoteIndexedAll)) {
      if (note.date === dateStr) {
        dayNotes[note.subject] = note
      }
    }
    setLocalNoteIndexed(dayNotes)
  }, [selectedDay, month, year, localNoteIndexedAll])

  async function handleSaveAll() {
    setLoading(true)
    setMessage(null)

    try {
      // Collect attendance data for the selected day
      const attendanceData: { student_id: number; day: number; value: string }[] = []

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

      // Collect KBM data for the selected day
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
      const kbmData: { subject: string; date: string; time: string; note: string; teacher_id?: string }[] = []

      for (const note of Object.values(localNoteIndexed)) {
        if (note.note.trim()) {
          kbmData.push({
            subject: note.subject,
            date: dateStr,
            time: note.time,
            note: note.note,
            teacher_id: note.teacher_id ?? undefined,
          })
        }
      }

      const response = await fetch(`/api/journal/save-all?class=${encodeURIComponent(grade)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  async function handleSaveNote(subject: string, note: string) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    const timeStr = new Date().toTimeString().slice(0, 5)

    try {
      const response = await fetch('/api/journal/save-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class: grade,
          subject,
          teacher_id: null,
          date: dateStr,
          time: timeStr,
          note,
          checked: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan catatan')
      }

      // Update local state
      setLocalNoteIndexed((prev) => {
        const newMap = { ...prev }
        newMap[subject] = {
          ...(newMap[subject] || {
            id: 0,
            class: grade,
            subject,
            teacher_id: null,
            date: dateStr,
            time: timeStr,
            note: '',
            checked: false,
          }),
          note,
          checked: true,
        }
        return newMap
      })

      // Update the all-notes map so it persists across day changes
      setLocalNoteIndexedAll((prev) => {
        const newMap = { ...prev }
        newMap[subject] = {
          ...(newMap[subject] || {
            id: 0,
            class: grade,
            subject,
            teacher_id: null,
            date: dateStr,
            time: timeStr,
            note: '',
            checked: false,
          }),
          note,
          checked: true,
        }
        return newMap
      })
    } catch (err) {
      console.error('Save note error:', err)
      throw err
    }
  }

  function handleAttendanceChange(studentId: number, d: number, value: 'S' | 'I' | 'A' | '') {
    setLocalAttendanceMap((prev) => {
      const newMap = { ...prev }
      const studentAtt = { ...(newMap[String(studentId)] || {}) }
      if (value) {
        studentAtt[d] = value
      } else {
        delete studentAtt[d]
      }
      newMap[String(studentId)] = studentAtt
      return newMap
    })
  }

  function handlePrevDay() {
    if (selectedDay > 1) {
      setSelectedDay(selectedDay - 1)
    }
  }

  function handleNextDay() {
    if (selectedDay < daysInMonth) {
      setSelectedDay(selectedDay + 1)
    }
  }

  function handleExportExcel() {
    if (!isAdmin) return
    const monthStr = String(month).padStart(2, '0')
    window.open(`/api/journal/export?class=${encodeURIComponent(grade)}&month=${monthStr}&year=${year}`, '_blank')
  }

  // Build subjects list for KBM editor
  const subjectsList = useMemo(() => {
    return Object.entries(mapelList).map(([subject, teacherNames]) => ({
      subject,
      teachers: teacherNames,
    }))
  }, [mapelList])

  const selectedDate = new Date(year, month - 1, selectedDay)
  const selectedDateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-4">
      {/* Branding header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">JOURNAL OF {grade} / ABBS JUNIOR HIGH SCHOOL</CardTitle>
        </CardHeader>
      </Card>

      {message ? (
        <FeedbackBanner
          tone={message.type}
          onDismiss={() => setMessage(null)}
        >
          {message.text}
        </FeedbackBanner>
      ) : null}

      {/* Date Navigation */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={handlePrevDay}
                disabled={selectedDay <= 1}
                aria-label="Hari sebelumnya"
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
              <div className="relative">
                <input
                  ref={dateInputRef}
                  type="text"
                  readOnly
                  className="h-9 w-[140px] cursor-not-allowed rounded-sm border border-border-default bg-surface-sunken px-3 text-sm text-text-secondary"
                  aria-label="Tanggal terpilih"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={handleNextDay}
                disabled={selectedDay >= daysInMonth}
                aria-label="Hari berikutnya"
              >
                <ChevronRight aria-hidden className="size-4" />
              </Button>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">
                {selectedDate.toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleExportExcel}
                >
                  <Download aria-hidden className="size-4" />
                  Export Excel
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                loading={loading}
                loadingText="Menyimpan..."
                onClick={handleSaveAll}
                disabled={loading}
              >
                Simpan Semua
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teachers / Subjects Section - Collapsible */}
      <Card>
        <button
          type="button"
          onClick={() => setTeachersExpanded(!teachersExpanded)}
          aria-expanded={teachersExpanded}
          className="focus-ring flex w-full items-center justify-between rounded-md border-0 bg-transparent p-3 text-left transition-colors duration-150 ease-out hover:bg-surface-hover"
        >
          <span className="flex items-center gap-2">
            <Users aria-hidden className="size-4 text-text-tertiary" />
            <span className="text-sm font-semibold text-text-primary">
              Guru & Mata Pelajaran - {grade}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={`size-4 text-text-tertiary transition-transform duration-150 ease-out ${teachersExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {teachersExpanded && (
          <div className="flex flex-col gap-3 border-t border-border-subtle p-3">
            {Object.keys(mapelList).length === 0 ? (
              <EmptyState
                title="Tidak ada jadwal untuk hari ini."
                description="Jadwal pelajaran untuk kelas ini belum diatur."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(mapelList).map(([subject, teacherNames]) => (
                  <Card key={subject} className="border-border-subtle bg-surface-sunken">
                    <CardContent className="py-2">
                      <h3 className="text-sm font-semibold text-text-primary">{subject}</h3>
                      <p className="mt-0.5 text-[13px] text-text-tertiary">
                        {teacherNames.join(', ')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Attendance Section - Collapsible */}
      <Card>
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExpandAll}
            >
              Expand All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCollapseAll}
            >
              Collapse All
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAttendanceExpanded(!attendanceExpanded)}
          aria-expanded={attendanceExpanded}
          className="focus-ring flex w-full items-center justify-between rounded-md border-0 bg-transparent p-3 text-left transition-colors duration-150 ease-out hover:bg-surface-hover"
        >
          <span className="flex items-center gap-2">
            <CheckSquare aria-hidden className="size-4 text-text-tertiary" />
            <span className="text-sm font-semibold text-text-primary">
              Absensi Siswa - Tgl {selectedDay}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={`size-4 text-text-tertiary transition-transform duration-150 ease-out ${attendanceExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {attendanceExpanded && (
          <div className="border-t border-border-subtle p-3">
            <div className="overflow-x-auto">
              <AttendanceGrid
                students={students}
                attendanceMap={localAttendanceMap}
                summaryMap={summaryMap}
                day={selectedDay}
                month={month}
                year={year}
                grade={grade}
                onAttendanceChange={handleAttendanceChange}
              />
            </div>
          </div>
        )}
      </Card>

      {/* KBM Section - Collapsible */}
      <Card>
        <button
          type="button"
          onClick={() => setKbmExpanded(!kbmExpanded)}
          aria-expanded={kbmExpanded}
          className="focus-ring flex w-full items-center justify-between rounded-md border-0 bg-transparent p-3 text-left transition-colors duration-150 ease-out hover:bg-surface-hover"
        >
          <span className="flex items-center gap-2">
            <BookOpen aria-hidden className="size-4 text-text-tertiary" />
            <span className="text-sm font-semibold text-text-primary">
              Jurnal KBM -{' '}
              {selectedDate.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={`size-4 text-text-tertiary transition-transform duration-150 ease-out ${kbmExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {kbmExpanded && (
          <div className="border-t border-border-subtle p-3">
            <KbmEditor
              subjects={subjectsList}
              noteIndexed={localNoteIndexed}
              classValue={grade}
              selectedDate={selectedDate}
              onSave={handleSaveNote}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
