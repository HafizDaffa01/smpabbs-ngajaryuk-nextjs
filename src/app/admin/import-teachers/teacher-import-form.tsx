'use client'

import { useState, useRef } from 'react'
import { FileSpreadsheet, Info } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dropzone } from '@/components/ui/dropzone'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
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
  nama: string
  email: string
  password: string
  phone: string
  mapel: string[]
  format: 'A' | 'B' | null
}

export default function TeacherImportForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [format, setFormat] = useState<'A' | 'B' | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setPreview(null)
    setFormat(null)

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

      const response = await fetch('/api/admin/import-teachers', {
        method: 'POST',
        body: importFormData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import gagal')
      }

      setMessage({
        type: 'success',
        text: `Import berhasil! ${data.imported ?? 0} guru diimpor. Format: ${data.format ?? 'Unknown'}`,
      })
      setFormat(data.format || null)
      setFileName(submitted.name)
      if (event.target instanceof HTMLFormElement) {
        event.target.reset()
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

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    if (!nextFile) {
      setPreview(null)
      setFormat(null)
      setFileName(null)
      return
    }

    setLoading(true)
    setMessage(null)
    setPreview(null)
    setFormat(null)

    try {
      const xlsx = await import('xlsx')
      const buffer = await nextFile.arrayBuffer()
      const workbook = xlsx.read(buffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

      if (jsonData.length === 0) {
        setMessage({ type: 'error', text: 'File Excel kosong' })
        setLoading(false)
        return
      }

      const headers = (jsonData[0] as unknown[]).map((h) => String(h ?? '').toLowerCase().trim())
      const rows = (jsonData.slice(1) as unknown[][]).map((row) => {
        const obj: { [key: string]: unknown } = {}
        headers.forEach((h, i) => {
          obj[h] = row[i]
        })
        return obj
      }).filter((row): row is { [key: string]: unknown } => Boolean(row.nama || row.name))

      // Detect format
      const hasRombel = headers.some((h) => /^[789][a-z]?$/i.test(h))
      const requiredA = ['math', 'ipa', 'ips', 'pkn', 'ict', 'pjok', 'indonesian', 'english', 'pai', 'quran']
      const matchCount = requiredA.filter((req) => headers.some((h) => h.toLowerCase().includes(req))).length
      const detectedFormat = hasRombel ? 'B' : matchCount >= 2 ? 'A' : null

      setFormat(detectedFormat)

      const previewRows: PreviewRow[] = rows.slice(0, 10).map((row) => {
        const nama = String(row.nama ?? row.name ?? '').trim()
        const email = String(row.email ?? '').trim()
        const password = String(row.password ?? '').trim()
        const phone = String(
          row.hp ?? row.telepon ?? row.wa ?? row.whatsapp ?? row.phone ?? row.num ?? row.number ?? ''
        ).trim()

        const mapel: string[] = []
        if (detectedFormat === 'B') {
          for (const [key, val] of Object.entries(row)) {
            if (/^[789][a-z]?$/i.test(key) && val) {
              const items = String(val).split(/\s*(?:&|\+|dan)\s*/i)
              mapel.push(...items.filter(Boolean))
            }
          }
        } else if (detectedFormat === 'A') {
          for (const [key, val] of Object.entries(row)) {
            if (!['no', 'nama', 'name', 'email', 'password', 'number', 'num', 'hp', 'telepon', 'wa', 'whatsapp', 'phone'].includes(key.toLowerCase())) {
              if (val && typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') {
                mapel.push(key.replace(/_/g, ' '))
              }
            }
          }
        }

        return { nama, email, password, phone, mapel, format: detectedFormat }
      })

      setPreview(previewRows)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat preview',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handlePreview} className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Upload Berkas</CardTitle>
            <CardDescription>
              Format A: Kolom = Mapel, Baris = Guru, Cell = Kelas · Format B: Kolom = Kelas (7A,
              8B...), Baris = Guru, Cell = Mapel · Kolom wajib: nama, email, password
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
            hint="Format dikenali otomatis dari nama kolom. Hanya sheet pertama yang dibaca."
          />

          {format ? (
            <FeedbackBanner tone="info">
              Format terdeteksi:{' '}
              <strong>
                {format === 'A' ? 'Format A (Mapel sebagai kolom)' : 'Format B (Kelas sebagai kolom)'}
              </strong>
            </FeedbackBanner>
          ) : null}

          {fileName ? (
            <p className="meta">
              Terakhir diimpor: {fileName}
            </p>
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
                Pastikan nama, email, dan password sudah terisi sebelum melanjutkan.
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
            <TableScroll label="Preview data guru">
              <Table className="min-w-[720px]">
                <TableCaption>Preview 10 baris pertama dari berkas guru</TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-surface-sunken">
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Mapel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-semibold text-text-primary">{row.nama}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell className="meta">{row.password}</TableCell>
                      <TableCell>{row.phone || '-'}</TableCell>
                      <TableCell>
                        {row.mapel.length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {row.mapel.map((subject) => (
                              <Badge key={subject} variant="neutral">
                                {subject}
                              </Badge>
                            ))}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-text-disabled">
                            <Info aria-hidden className="size-3.5" />
                            -
                          </span>
                        )}
                      </TableCell>
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
          Import Guru
        </Button>
      </div>
    </form>
  )
}
