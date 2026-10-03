'use client'

import { useState, useEffect, useRef } from 'react'
import Flatpickr from 'flatpickr'
import 'flatpickr/dist/themes/airbnb.css'
import 'flatpickr/dist/l10n/id.js'
import Swal from 'sweetalert2'
import { BookOpenText, CheckCircle2, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, Input, Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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

type SubjectInfo = {
  subject: string
  teachers: string[]
}

interface KbmEditorProps {
  subjects: SubjectInfo[]
  noteIndexed: Record<string, Note>
  classValue: string
  selectedDate: Date
  onSave: (subject: string, note: string) => Promise<void>
}

export default function KbmEditor({
  subjects,
  noteIndexed,
  classValue,
  selectedDate,
  onSave,
}: KbmEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentSubject, setCurrentSubject] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const flatpickrRef = useRef<Flatpickr.Instance | null>(null)

  const dateStr = selectedDate.toISOString().split('T')[0]
  const displayDate = selectedDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    if (isOpen && dateInputRef.current && !flatpickrRef.current) {
      flatpickrRef.current = Flatpickr(dateInputRef.current, {
        dateFormat: 'Y-m-d',
        defaultDate: dateStr,
        locale: 'id',
        allowInput: true,
        onChange: (selectedDates) => {
          if (selectedDates[0]) {
            const newDate = selectedDates[0]
            // Update the selected date in parent if needed
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
  }, [isOpen, dateStr])

  function openEditor(subject: string) {
    const existing = noteIndexed[subject]
    setCurrentSubject(subject)
    setNoteText(existing?.note || '')
    setIsOpen(true)
  }

  function closeEditor() {
    setIsOpen(false)
    setCurrentSubject(null)
    setNoteText('')
  }

  async function handleSave() {
    if (!currentSubject || !noteText.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Catatan kosong',
        text: 'Masukkan catatan KBM terlebih dahulu',
        confirmButtonText: 'OK',
      })
      return
    }

    setSaving(true)
    try {
      await onSave(currentSubject, noteText.trim())
      await Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Catatan KBM berhasil disimpan',
        confirmButtonText: 'OK',
      })
      closeEditor()
    } catch {
      await Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: 'Gagal menyimpan catatan KBM',
        confirmButtonText: 'OK',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* KBM List */}
      {subjects.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Belum ada mata pelajaran."
          description="Tidak ada jadwal untuk hari ini."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {subjects.map(({ subject, teachers }) => {
            const existing = noteIndexed[subject]
            const hasNote = existing?.note?.trim()

            return (
              <Card
                key={subject}
                onClick={() => openEditor(subject)}
                className={cn(
                  'transition-[border-color,box-shadow] duration-150 ease-out',
                  'cursor-pointer hover:border-border-strong hover:shadow-md',
                  hasNote && 'border-success-border'
                )}
              >
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle as="h3" className="flex items-center gap-2">
                      <BookOpenText aria-hidden className="size-4 shrink-0 text-text-tertiary" />
                      {subject}
                    </CardTitle>
                    <CardDescription>Guru: {teachers.join(', ')}</CardDescription>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {hasNote ? <Badge variant="success">Tersimpan</Badge> : null}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="max-sm:min-h-11"
                      onClick={() => openEditor(subject)}
                    >
                      {hasNote ? (
                        <Pencil aria-hidden className="size-3.5" />
                      ) : (
                        <Plus aria-hidden className="size-3.5" />
                      )}
                      {hasNote ? 'Edit KBM' : 'Tambah KBM'}
                    </Button>
                  </div>
                </CardHeader>

                {hasNote ? (
                  <CardContent>
                    {/* Success callout — token-driven, with the icon carrying the
                        meaning alongside the colour. */}
                    <div className="flex items-start gap-2.5 rounded-md border border-success-border border-l-4 bg-success-bg py-2.5 pr-3 pl-3 text-[13px] text-success-text">
                      <CheckCircle2 aria-hidden className="mt-px size-4 shrink-0" />
                      <p className="min-w-0 flex-1 leading-relaxed">
                        <strong className="font-semibold">Catatan:</strong>{' '}
                        {existing.note.slice(0, 100)}
                        {existing.note.length > 100 && '...'}
                      </p>
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      {/* KBM Modal */}
      <Dialog
        open={isOpen && currentSubject !== null}
        onOpenChange={(next) => !next && closeEditor()}
        size="md"
        title={`Edit Jurnal KBM - ${currentSubject ?? ''}`}
        description={`Kelas ${classValue} · ${displayDate}`}
        footer={
          <>
            <Button variant="secondary" onClick={closeEditor}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={saving} loadingText="Menyimpan...">
              Simpan
            </Button>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
          <Field id="kbm-date" label="Tanggal">
            {(field) => (
              <Input {...field} ref={dateInputRef} type="text" readOnly />
            )}
          </Field>

          <Field id="kbm-subject" label="Mapel">
            {(field) => <Input {...field} type="text" value={currentSubject ?? ''} readOnly />}
          </Field>

          <Field
            id="kbm-note"
            label="Catatan KBM"
            hint="Catatan disimpan untuk tanggal di atas dan muncul di Rekap KBM."
          >
            {(field) => (
              <Textarea
                {...field}
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Masukkan catatan pembelajaran..."
                rows={6}
              />
            )}
          </Field>
        </form>
      </Dialog>
    </>
  )
}
