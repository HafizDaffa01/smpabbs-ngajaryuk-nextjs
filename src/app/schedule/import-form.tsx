'use client'

import { useState, useRef } from 'react'

export default function ScheduleImportForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [preview, setPreview] = useState<Record<string, string[][]> | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
      <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Import Jadwal dari aSc Timetables
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Upload file v9.4.xlsx dari aSc Timetables. File akan di-parse dan diimport ke database.
      </p>

      {message && (
        <div
          className={`mb-4 rounded-md p-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handlePreview} className="flex flex-col gap-4">
        <div>
          <label htmlFor="file_v94" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            File Excel (v9.4.xlsx)
          </label>
          <input
            ref={fileInputRef}
            id="file_v94"
            name="file_v94"
            type="file"
            accept=".xlsx,.xls"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {!showConfirm && (
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {loading ? 'Memproses...' : 'Preview File'}
          </button>
        )}
      </form>

      {showConfirm && preview && (
        <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
            Preview Import
          </h3>
          <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            <p>Sheets found: {preview.sheetNames?.length || 0}</p>
             {preview.sheets && Object.entries(preview.sheets).map(([name, rows]) => (
              <div key={name} className="mt-2">
                <p className="font-medium">{name}:</p>
                <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
                  {JSON.stringify(rows, null, 2)}
                </pre>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex-1 rounded-md bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Mengimpor...' : 'Konfirmasi Import'}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false)
                setPreview(null)
              }}
              className="flex-1 rounded-md bg-zinc-200 px-4 py-2 font-medium text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
