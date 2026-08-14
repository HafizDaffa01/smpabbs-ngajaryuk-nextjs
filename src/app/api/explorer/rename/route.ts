import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { oldPath, newName } = await request.json()

    if (!oldPath || !newName) {
      return NextResponse.json({ error: 'Path dan nama baru harus diisi' }, { status: 400 })
    }

    // Validate new name
    if (!/^[a-zA-Z0-9_.-]+$/.test(newName)) {
      return NextResponse.json(
        { error: 'Nama hanya boleh huruf, angka, underscore, dash, dan titik' },
        { status: 400 }
      )
    }

    // Download the file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(oldPath)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
    }

    // Upload with new name
    const newPath = oldPath.split('/').slice(0, -1).join('/') ? `${oldPath.split('/').slice(0, -1).join('/')}/${newName}` : newName

    const { error: uploadError } = await supabase.storage.from('uploads').upload(newPath, fileData, {
      upsert: true,
    })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Delete old file
    const { error: deleteError } = await supabase.storage.from('uploads').remove([oldPath])

    if (deleteError) {
      console.error('Delete old file error:', deleteError)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
