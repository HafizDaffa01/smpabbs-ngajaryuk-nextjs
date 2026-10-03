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

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const path = formData.get('path') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/']
    const isValidType = allowedTypes.some((type) => file.type.startsWith(type))
    if (!isValidType) {
      return NextResponse.json(
        { error: 'Tipe file tidak diizinkan. Hanya gambar, PDF, ZIP, dan dokumen teks.' },
        { status: 400 }
      )
    }

    const filePath = path ? `${path}/${file.name}` : file.name

    const { error } = await supabase.storage.from('uploads').upload(filePath, file, {
      upsert: true,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
