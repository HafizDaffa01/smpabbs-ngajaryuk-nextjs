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
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    // Dynamic import of xlsx to avoid bundling issues
    const xlsx = await import('xlsx')

    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: 'buffer' })

    let imported = 0
    const errors: string[] = []

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const jsonData = xlsx.utils.sheet_to_json<[string, string]>(sheet, { header: 1 })

      for (const row of jsonData) {
        if (row.length < 2) continue

        const name = String(row[0] ?? '').trim()
        const grade = String(row[1] ?? '').trim()

        if (!name || !grade) continue

        // Skip header rows
        if (name.toLowerCase() === 'nama' || name.toLowerCase() === 'name') continue

        try {
        const { error } = await supabase.from('students').upsert(
          {
            name,
            grade: grade.toUpperCase(),
          },
          { onConflict: 'name,grade' }
        )

          if (error) {
            errors.push(`Gagal import ${name}: ${error.message}`)
          } else {
            imported++
          }
        } catch {
          errors.push(`Gagal import ${name}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
