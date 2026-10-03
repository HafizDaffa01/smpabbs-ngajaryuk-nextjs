import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    if (type === 'csv') {
      // Export absensis as CSV
      let query = supabase.from('absensis').select('*').order('waktu')
      if (month && year) {
        const startDate = `${year}-${month.padStart(2, '0')}-01`
        const endDate = `${year}-${month.padStart(2, '0')}-31`
        query = query.gte('waktu', startDate).lte('waktu', endDate)
      }

      const { data: absensis } = await query

      if (!absensis || absensis.length === 0) {
        return NextResponse.json({ error: 'Tidak ada data' }, { status: 404 })
      }

      const headers = ['ID', 'Nama', 'Unit', 'Lokasi', 'Alamat', 'Waktu', 'Akurasi']
      const rows = absensis.map((a) => [
        a.id,
        a.nama,
        a.unit,
        a.lokasi,
        a.alamat || '',
        a.waktu,
        a.akurasi || '',
      ])

      const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=absensi_${year}_${month}.csv`,
        },
      })
    }

    if (type === 'zip') {
      // Export images as ZIP
      const JSZip = (await import('jszip')).default

      const { data: absensis } = await supabase.from('absensis').select('foto').not('foto', 'is', null)

      if (!absensis || absensis.length === 0) {
        return NextResponse.json({ error: 'Tidak ada foto' }, { status: 404 })
      }

      const zip = new JSZip()
      const folder = zip.folder('uploads')

      for (const absen of absensis) {
        if (!absen.foto) continue
        const url = new URL(absen.foto)
        const pathname = url.pathname.split('/').pop() || ''

        try {
          const response = await fetch(absen.foto)
          const blob = await response.blob()
          const arrayBuffer = await blob.arrayBuffer()
          folder?.file(pathname, Buffer.from(arrayBuffer))
        } catch {
          console.error(`Failed to fetch image: ${absen.foto}`)
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      return new NextResponse(Buffer.from(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename=uploads.zip',
        },
      })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
