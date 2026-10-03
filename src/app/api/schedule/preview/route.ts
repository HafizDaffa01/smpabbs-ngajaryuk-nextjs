import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file_v94') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    const xlsx = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: 'buffer' })

    const preview: Record<string, string[][]> = {}
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows: string[][] = []
      const maxRows = Math.min(5, sheet['!row'] ? sheet['!row'].length : 5)
      const maxCols = Math.min(8, sheet['!col'] ? sheet['!col'].length : 8)

      for (let r = 1; r <= maxRows; r++) {
        const row: string[] = []
        for (let c = 1; c <= maxCols; c++) {
          const cell = sheet[`${String.fromCharCode(64 + c)}${r}`]
          row.push(cell ? String(cell.v) : '')
        }
        rows.push(row)
      }
      preview[sheetName] = rows
    }

    return NextResponse.json({
      status: 'success',
      sheets: preview,
      sheetNames: workbook.SheetNames,
    })
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Gagal membaca file' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
