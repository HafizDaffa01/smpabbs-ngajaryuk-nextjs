'use client'

import { useState, useRef } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dropzone } from '@/components/ui/dropzone'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Field, Select } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from '@/components/ui/table'

interface PreviewRow {
  name: string
  grade: string
  sheet: string
}

export default function ImportStudentsForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    if (!nextFile) {
      // Cleared through the dropzone's remove action.
      setPreview(null)
      setSheets([])
      return
    }

    setLoading(true)
    setMessage(null)
    setPreview(null)
    setSheets([])

    try {
      const xlsx = await import('xlsx')
      const buffer = await nextFile.arrayBuffer()
      const workbook = xlsx.read(buffer, { type: 'buffer' })

      const sheetNames = workbook.SheetNames
      setSheets(sheetNames)
      setSelectedSheet(sheetNames[0] || '')

      if (sheetNames.length > 0) {
        const sheet = workbook.Sheets[sheetNames[0]]
        const jsonData = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

        if (jsonData.length > 0) {
          const rows = jsonData.slice(1) as unknown[][]
          const previewRows: PreviewRow[] = rows.slice(0, 10).map((row) => ({
            name: String(row[0] ?? '').trim(),
            grade: String(row[1] ?? '').trim(),
            sheet: sheetNames[0],
          })).filter((r) => r.name)

          setPreview(previewRows)
        }
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat preview',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    const submitted = formData.get('file') as File

    if (!submitted) {
      setMessage({ type: 'error', text: 'Pilih file Excel terlebih dahulu' })
      setLoading(false)
      return
    }

    try {
      const importFormData = new FormData()
      importFormData.append('file', submitted)

      const response = await fetch('/api/import-students', {
        method: 'POST',
        body: importFormData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import gagal')
      }

      setMessage({
        type: 'success',
        text: `Import berhasil! ${data.imported ?? 0} siswa diimpor.`,
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setFile(null)
      setPreview(null)
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Upload Berkas</CardTitle>
            <CardDescription>
              Format: Kolom 1 = Nama, Kolom 2 = Kelas. File dapat memiliki multiple sheet.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Dropzone
            id="file"
            name="file"
            accept=".xlsx,.xls"
            required
            disabled={loading}
            file={file}
            inputRef={fileInputRef}
            onFileChange={handleFileChange}
            hint="Ukuran berkas tidak dibatasi. Baris pertama pada sheet dianggap judul kolom."
          />

          {sheets.length > 1 ? (
            <Field
              id="sheet"
              label="Sheet"
              hint={`Berkas ini berisi ${sheets.length} sheet. Hanya sheet pertama yang dipratinjau.`}
            >
              {(field) => (
                <Select
                  {...field}
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                >
                  {sheets.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}

          {message ? (
            <FeedbackBanner tone={message.type} onDismiss={() => setMessage(null)}>
              {message.text}
            </FeedbackBanner>
          ) : null}
        </CardContent>
      </Card>

      {preview && preview.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Preview (10 baris pertama)</CardTitle>
              <CardDescription>
                Periksa kolom nama dan kelas sebelum melanjutkan.
              </CardDescription>
            </div>
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-text"
            >
              <FileSpreadsheet className="size-5" />
            </span>
          </CardHeader>
          <CardContent>
            <TableScroll label="Preview data siswa">
              <Table className="min-w-[520px]">
                <TableCaption>Preview 10 baris pertama dari berkas</TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-surface-sunken">
                    <TableHead>Nama</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Sheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-semibold text-text-primary">{row.name}</TableCell>
                      <TableCell>{row.grade}</TableCell>
                      <TableCell className="meta">{row.sheet}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={loading} disabled={!file} loadingText="Mengimpor...">
          Import Siswa
        </Button>
      </div>
    </form>
  )
}
