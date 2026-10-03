import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function DELETE(request: NextRequest) {
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

    const { path } = await request.json()

    if (!path) {
      return NextResponse.json({ error: 'Path harus diisi' }, { status: 400 })
    }

    // List all files in the folder
    const { data: files, error: listError } = await supabase.storage.from('uploads').list(path)

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    // Delete all files in the folder
    const filePaths = files?.map((f) => `${path}/${f.name}`) || []
    if (filePaths.length > 0) {
      const { error: deleteError } = await supabase.storage.from('uploads').remove(filePaths)
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
