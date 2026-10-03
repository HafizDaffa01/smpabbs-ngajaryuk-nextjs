import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

const SCHOOL_LAT = -7.5564
const SCHOOL_LON = 110.8347
const MAX_RADIUS = 1000 // meters

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

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

    const { lokasi, alamat, foto } = await request.json()

    if (!lokasi || !alamat || !foto) {
      return NextResponse.json(
        { error: 'Lokasi, alamat, dan foto harus diisi' },
        { status: 400 }
      )
    }

    const [latStr, lonStr] = lokasi.split(',')
    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ error: 'Koordinat tidak valid' }, { status: 400 })
    }

    const distance = haversineDistance(lat, lon, SCHOOL_LAT, SCHOOL_LON)
    if (distance > MAX_RADIUS) {
      return NextResponse.json(
        { error: `Anda berada di luar radius sekolah (${distance.toFixed(2)} m). Presensi ditolak.` },
        { status: 403 }
      )
    }

    // Check duplicate check-in today
    const { data: existingAbsensi } = await supabase
      .from('absensis')
      .select('id, waktu')
      .eq('user_id', user.id)
      .gte('waktu', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .lt('waktu', new Date(new Date().setHours(23, 59, 59, 999)).toISOString())
      .maybeSingle()

    if (existingAbsensi) {
      return NextResponse.json(
        { error: `Anda sudah presensi hari ini` },
        { status: 409 }
      )
    }

    // Process base64 photo
    const base64Data = foto.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Ukuran foto terlalu besar (maksimal 5MB)' },
        { status: 400 }
      )
    }

    // Determine MIME type
    const mimeType = foto.match(/data:image\/(\w+);base64/)?.[1] || 'image/png'
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedMimes.includes(mimeType)) {
        return NextResponse.json(
        { error: 'Format foto tidak valid. Hanya JPEG, PNG, GIF, WebP yang diizinkan.' },
        { status: 400 }
      )
    }

    // Get profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, phone_num')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile tidak ditemukan' }, { status: 404 })
    }

    // Upload photo to Supabase Storage
    const fileName = `${profile.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}@${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${mimeType.split('/')[1]}`
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Gagal upload foto' }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName)

    // Save to database
    const { error: insertError } = await supabase.from('absensis').insert({
      user_id: user.id,
      nama: profile.name,
      unit: 'SMP ABBS Surakarta',
      lokasi,
      alamat,
      foto: urlData.publicUrl,
      waktu: new Date().toISOString(),
    })

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Gagal menyimpan presensi' }, { status: 500 })
    }

    // Send WhatsApp notification (async, non-blocking)
    const phone = (profile.phone_num ?? '').replace(/[^0-9]/g, '')
    if (phone) {
      try {
        const dayMap: Record<string, string> = {
          Monday: 'Senin',
          Tuesday: 'Selasa',
          Wednesday: 'Rabu',
          Thursday: 'Kamis',
          Friday: 'Jumat',
          Saturday: 'Sabtu',
          Sunday: 'Minggu',
        }
        const dayEn = new Date().toLocaleDateString('en-US', { weekday: 'long' })
        const dayId = dayMap[dayEn] || dayEn
        const tglNow = new Date().toLocaleDateString('id-ID')
        const jamNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

        const { data: schedules } = await supabase
          .from('schedules')
          .select('period, subject, class_name')
          .ilike('teacher', `%${profile.name}%`)
          .eq('day', dayEn)
          .order('period')

        const teachingList =
          schedules && schedules.length > 0
            ? schedules.map((s) => `- Jam ${s.period}: ${s.subject} (${s.class_name})`).join('\n')
            : '(Tidak ada jadwal hari ini)'

        const message = `[NgajarYuk]\n\nHalo *${profile.name}*, terima kasih sudah melakukan Presensi ✅\n\nBerikut jadwal mengajar Anda hari ini (${dayId}):\n\n${teachingList}\n\n📌 Jangan lupa untuk mengisi jurnal harian setelah kegiatan mengajar.\n\n🔗 *Isi Jurnal:*\ngurusmpabbs.alabidin.sch.id/journal\n\nTetap semangat mengajar! 💪\nTanggal: ${tglNow}\n\nWaktu : *${jamNow}*`

        const fonnceApiKey = process.env.FONNTE_API_KEY
        const fonnteDeviceId = process.env.FONNTE_DEVICE_ID

        if (fonnceApiKey) {
          const payload: Record<string, unknown> = {
            target: phone,
            message,
            countryCode: '62',
          }
          if (fonnteDeviceId) {
            payload.device = fonnteDeviceId
          }

          fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
              Authorization: fonnceApiKey,
            },
            body: JSON.stringify(payload),
          }).catch((err) => {
            console.error('Fonnte notification error:', err)
          })
        }
      } catch (err) {
        console.error('WhatsApp notification error:', err)
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
