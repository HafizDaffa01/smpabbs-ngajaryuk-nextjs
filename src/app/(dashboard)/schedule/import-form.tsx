'use client'

import { useState, useRef } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dropzone } from '@/components/ui/dropzone'
import { FeedbackBanner } from '@/components/ui/feedback-banner'

export default function ScheduleImportForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [preview, setPreview] = useState<Record<string, string[][]> | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  // Mirrors the Dropzone's own selection so the tile can show idle vs chosen.
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    if (!nextFile) {
      // Cleared through the dropzone's remove action — drop the stale preview.
      setPreview(null)
      setShowConfirm(false)
    }
  }

  async function handlePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    const file = formData.get('file_v94') as File

    if (!file) {
      setMessage({ type: 'error', text: 'Pilih file Excel terlebih dahulu' })
      setLoading(false)
      return
    }

    try {
      const previewFormData = new FormData()
      previewFormData.append('file_v94', file)

      const response = await fetch('/api/schedule/preview', {
        method: 'POST',
        body: previewFormData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Gagal membaca file')
      }

      setPreview(data)
      setShowConfirm(true)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!preview) return

    setLoading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      const file = fileInputRef.current?.files?.[0]
      if (!file) {
        setMessage({ type: 'error', text: 'File tidak ditemukan' })
        setLoading(false)
        return
      }

      formData.append('file_v94', file)
      formData.append('confirm', 'on')

      const response = await fetch('/api/schedule/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import gagal')
      }

      setMessage({
        type: 'success',
        text: data.message || 'Import berhasil!',
      })
      setShowConfirm(false)
      setPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setFile(null)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? (
        <FeedbackBanner tone={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </FeedbackBanner>
      ) : null}

      <form onSubmit={handlePreview} className="flex flex-col gap-4">
        {/* The real `<input type="file" name="file_v94">` lives inside this form
            (visually hidden by the Dropzone), which is what keeps
            `formData.get('file_v94')` working. */}
        <Dropzone
          id="file_v94"
          name="file_v94"
          accept=".xlsx,.xls"
          required
          disabled={loading}
          file={file}
          inputRef={fileInputRef}
          onFileChange={handleFileChange}
          hint="Berkas hasil ekspor aSc Timetables versi 9.4, misalnya v9.4.xlsx. Pratinjau sheet ditampilkan sebelum data diimport."
        />

        {!showConfirm && (
          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={loading} loadingText="Memproses...">
              Preview File
            </Button>
          </div>
        )}
      </form>

      {showConfirm && preview && (
        <section
          aria-labelledby="preview-import-heading"
          className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-sunken p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="preview-import-heading" className="text-sm font-semibold text-text-primary">
              Preview Import
            </h3>
            <Badge variant="info">
              <FileSpreadsheet aria-hidden className="size-3.5" />
              Sheets found: {preview.sheetNames?.length || 0}
            </Badge>
          </div>

          <p className="text-[13px] text-text-tertiary">
            Periksa isi sheet di bawah sebelum mengonfirmasi import.
          </p>

          <div className="flex flex-col gap-4">
            {preview.sheets &&
              Object.entries(preview.sheets).map(([name, rows]) => (
                <div key={name} className="flex flex-col gap-1.5">
                  <p className="text-[13px] font-semibold text-text-primary">{name}:</p>
                  <pre className="overflow-x-auto rounded-sm border border-border-subtle bg-surface-card p-2 text-[12px] leading-relaxed text-text-secondary">
                    {JSON.stringify(rows, null, 2)}
                  </pre>
                </div>
              ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleImport}
              loading={loading}
              loadingText="Mengimpor..."
              className="sm:flex-1"
            >
              Konfirmasi Import
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowConfirm(false)
                setPreview(null)
              }}
              className="sm:flex-1"
            >
              Batal
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}