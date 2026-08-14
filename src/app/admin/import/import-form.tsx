'use client'

import { useState, useRef } from 'react'

export default function ImportStudentsForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    const file = formData.get('file') as File

    if (!file) {
      setMessage({ type: 'error', text: 'Pilih file Excel terlebih dahulu' })
      setLoading(false)
      return
    }

    try {
      const importFormData = new FormData()
      importFormData.append('file', file)

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
        Import Siswa dari Excel
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Upload file Excel dengan format: Kolom 1 = Nama, Kolom 2 = Kelas.
        File dapat memiliki multiple sheet.
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="file" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            File Excel
          </label>
          <input
            ref={fileInputRef}
            id="file"
            name="file"
            type="file"
            accept=".xlsx,.xls"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {loading ? 'Mengimpor...' : 'Import Siswa'}
        </button>
      </form>
    </div>
  )
}
