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

    const { path, newFolder } = await request.json()

    if (!newFolder) {
      return NextResponse.json({ error: 'Nama folder harus diisi' }, { status: 400 })
    }

    // Validate folder name (alphanumeric + _-)
    if (!/^[a-zA-Z0-9_-]+$/.test(newFolder)) {
      return NextResponse.json(
        { error: 'Nama folder hanya boleh huruf, angka, underscore, dan dash' },
        { status: 400 }
      )
    }

    const folderPath = path ? `${path}/${newFolder}` : newFolder

    // Create a placeholder file to represent the folder in Supabase Storage
    const { error } = await supabase.storage.from('uploads').upload(`${folderPath}/.gitkeep`, Buffer.from(''))

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
