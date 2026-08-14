import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { normalizeSubject, normalizeMapel } from '@/lib/subject-normalizer'

const MAPEL_MAPPING: Record<string, string> = {
  // Agama
  pai: 'IFE',
  agama: 'IFE',
  islam: 'IFE',
  pendidikan_agama_islam: 'IFE',
  pendidikan_agama: 'IFE',
  btq: 'Quran',
  quran: "Quran",
  "qur'an": 'Quran',
  tahfidz: 'Quran',

  // Exact
  math: 'Mathematics',
  mtk: 'Mathematics',
  matematika: 'Mathematics',
  mat: 'Mathematics',

  science: 'Science',
  ipa: 'Science',
  biologi: 'Science',
  fisika: 'Science',

  // Social
  ips: 'Social',
  social: 'Social',
  sejarah: 'Social',
  geografi: 'Social',
  ekonomi: 'Social',

  // Language
  english: 'English',
  inggris: 'English',
  bahasa_inggris: 'English',
  'b.inggris': 'English',
  'b. inggris': 'English',
  indonesian: 'Indonesian',
  indo: 'Indonesian',
  indonesia: 'Indonesian',
  bahasa_indo: 'Indonesian',
  bahasa_indonesia: 'Indonesian',
  'b.indo': 'Indonesian',
  'b. indonesia': 'Indonesian',

  // Character / Civics
  pkn: 'Civics',
  ppkn: 'Civics',
  civics: 'Civics',
  pendidikan_pancasila: 'Civics',
  leadership: 'Leadership',
  pramuka: 'Leadership',

  // Physical Education
  sport: 'SPORT',
  pjok: 'SPORT',
  olahraga: 'SPORT',
  penjas: 'SPORT',
  olga: 'SPORT',

  // Technology
  ict: 'ICT',
  computer: 'ICT',
  komputer: 'ICT',
  tik: 'ICT',
  informatika: 'ICT',

  // TKA
  'tka math': 'TKA Mathematics',
  'tka mtk': 'TKA Mathematics',
  tm: 'TKA Mathematics',
  'tka ind': 'TKA INDO',
  'tka indo': 'TKA INDO',
  ti: 'TKA INDO',

  // Local Wisdom
  bahasa_jawa: 'Javanese',
  'b. jawa': 'Javanese',
  jawa: 'Javanese',
}

function mapSubject(rawSubject: string): string | null {
  const trimmed = rawSubject.trim()
  if (!trimmed || trimmed === '-') return null

  const key = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '')
  return MAPEL_MAPPING[key] || normalizeSubject(trimmed) || trimmed
}

function flattenClasses(items: { mapel: string; kelas: string }[]): { mapel: string; kelas: string }[] {
  const flattened: { mapel: string; kelas: string }[] = []
  const uniqueKeys = new Set<string>()

  for (const item of items) {
    const mapel = item.mapel
    const kelasRaw = item.kelas

    // Expand class range e.g. "A-F" -> "ABCDEF"
    const kelasExpanded = kelasRaw.replace(/([A-Za-z])-([A-Za-z])/g, (_, start, end) => {
      const s = start.toUpperCase()
      const e = end.toUpperCase()
      if (s <= e) {
        let res = ''
        for (let c = s.charCodeAt(0); c <= e.charCodeAt(0); c++) {
          res += String.fromCharCode(c)
        }
        return res
      }
      return _
    })

    // Find all patterns of Number + Letters (e.g. "7 ABC", "8A", "7")
    const matches = [...kelasExpanded.matchAll(/([789])\s*([A-Za-z]+)?/g)]

    if (matches.length > 0) {
      for (const m of matches) {
        const grade = m[1]
        const lettersMatch = m[2] ?? ''

        if (lettersMatch === '') {
          const key = `${mapel}|${grade}`
          if (!uniqueKeys.has(key)) {
            uniqueKeys.add(key)
            flattened.push({ mapel, kelas: grade })
          }
        } else {
          const letters = lettersMatch.toUpperCase().replace(/\s/g, '')
          for (const l of letters) {
            const key = `${mapel}|${grade}${l}`
            if (!uniqueKeys.has(key)) {
              uniqueKeys.add(key)
              flattened.push({ mapel, kelas: `${grade}${l}` })
            }
          }
        }
      }
    } else {
      const kelasFinal = kelasExpanded.trim()
      if (kelasFinal && kelasFinal !== '-') {
        const key = `${mapel}|${kelasFinal}`
        if (!uniqueKeys.has(key)) {
          uniqueKeys.add(key)
          flattened.push({ mapel, kelas: kelasFinal })
        }
      }
    }
  }

  return flattened
}

function detectFormat(headers: string[], rows: { [key: string]: unknown }[]): 'A' | 'B' | null {
  // Detect Format B: headers are classes (e.g. '7a', '8b', '9')
  const hasRombel = headers.some((h) => /^[789][a-z]?$/i.test(h))

  if (hasRombel) {
    const keywords = ['matematika', 'ipa', 'ips', 'pkn', 'ict', 'pjok', 'indonesian', 'english', 'pai', 'quran', 'tka']
    const found = rows.some((row) =>
      Object.values(row).some((cell) => {
        if (typeof cell === 'string') {
          const lower = cell.toLowerCase()
          return keywords.some((k) => lower.includes(k))
        }
        return false
      })
    )
    if (found) return 'B'
  }

  // Detect Format A: headers are subjects
  const requiredA = ['math', 'ipa', 'ips', 'pkn', 'ict', 'pjok', 'indonesian', 'english', 'pai', 'quran']
  const matchCount = requiredA.filter((req) => headers.some((h) => h.toLowerCase().includes(req))).length

  if (matchCount >= 2) {
    const found = rows.some((row) =>
      Object.entries(row).some(([key, cell]) => {
        const lowerKey = key.toLowerCase()
        if (['no', 'nama', 'name', 'email', 'password', 'number', 'num', 'hp', 'telepon', 'wa', 'whatsapp', 'phone'].includes(lowerKey)) {
          return false
        }
        if (typeof cell === 'string' && /[789]\s?[a-f]/i.test(cell)) {
          return true
        }
        return false
      })
    )
    if (found) return 'A'
  }

  return null
}

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

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    const xlsx = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: 'buffer' })

    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
    }

    const headers = (jsonData[0] as unknown[]).map((h) => String(h ?? '').toLowerCase().trim())
    const rows = (jsonData.slice(1) as unknown[][]).map((row) => {
      const obj: { [key: string]: unknown } = {}
      headers.forEach((h, i) => {
        obj[h] = row[i]
      })
      return obj
    }).filter((row): row is { [key: string]: unknown } => Boolean(row.nama || row.name))

    const formatType = detectFormat(headers, rows)

    const importedEmails: string[] = []

    for (const row of rows) {
      const nama = String(row.nama ?? row.name ?? '').trim()
      const email = String(row.email ?? '').trim()
      const password = String(row.password ?? '').trim()
      const phone = String(
        row.hp ?? row.telepon ?? row.wa ?? row.whatsapp ?? row.phone ?? row.num ?? row.number ?? ''
      ).trim()

      if (!nama || !email || !password) continue

      importedEmails.push(email)

      // Get or create auth user
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingUsers?.users.find((u) => u.email === email)

      let userId: string

      if (existingUser) {
        userId = existingUser.id
        await supabase.auth.admin.updateUserById(userId, {
          password,
        })
      } else {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })

        if (createError || !newUser.user) {
          console.error('Create user error:', createError)
          continue
        }

        userId = newUser.user.id
      }

      // Process mapel
      const rawItems: { mapel: string; kelas: string }[] = []

      if (formatType === 'B' || formatType === null) {
        for (const [key, val] of Object.entries(row)) {
          const lowerKey = key.toLowerCase()
          if (lowerKey.match(/^[789][a-z]?$/i) && val) {
            const kelas = lowerKey.toUpperCase()
            const items = String(val).split(/\s*(?:&|\+|dan)\s*/i)
            for (const m of items) {
              const mapped = mapSubject(m)
              if (mapped && mapped !== '' && mapped !== '-') {
                rawItems.push({ mapel: mapped, kelas })
              }
            }
          }
        }
      } else if (formatType === 'A') {
        for (const [key, val] of Object.entries(row)) {
          const lowerKey = key.toLowerCase()
          if (['no', 'nama', 'name', 'email', 'password', 'number', 'num', 'hp', 'telepon', 'wa', 'whatsapp', 'phone'].includes(lowerKey)) {
            continue
          }
          if (val && typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') {
            const mapped = mapSubject(key.replace(/_/g, ' '))
            if (mapped && mapped !== '') {
              rawItems.push({ mapel: mapped, kelas: val.trim() })
            }
          }
        }
      }

      const flattenedMapel = flattenClasses(rawItems)
      const normalizedMapel = normalizeMapel(flattenedMapel)

      // Update profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        name: nama,
        is_admin: false,
        phone_num: phone || null,
        mapel: normalizedMapel,
      })

      if (profileError) {
        console.error('Profile update error:', profileError)
      }
    }

    // Delete teachers not in import
    if (importedEmails.length > 0) {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_admin', false)

      if (allProfiles) {
        for (const profile of allProfiles) {
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
          if (authUser?.user?.email && !importedEmails.includes(authUser.user.email)) {
            await supabase.from('profiles').delete().eq('id', profile.id)
            await supabase.auth.admin.deleteUser(profile.id)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedEmails.length,
      format: formatType,
    })
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
