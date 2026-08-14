import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { normalizeMapel } from '@/lib/subject-normalizer'
import {
  SUBJECT_SHEETS,
  LEADERSHIP_SHEETS,
  LEADERSHIP_CODE_OF_SHEET,
  WITHOUT_TEACHER_SHEETS,
} from '@/lib/bell-schedule'
import {
  readClassesSheet,
  readTeachersSheet,
  readLessonsSheet,
  processSubjectSheet,
  processLeadershipSheet,
  processWithoutTeacherSheet,
  processAvailableTeachersFormat,
  hasAvailableTeachersFormat,
  generateEmailFromName,
} from '@/lib/v94-parser'
import type { ScheduleRecord } from '@/lib/bell-schedule'

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
    const file = formData.get('file_v94') as File | null
    const confirm = formData.get('confirm')

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (confirm !== 'on') {
      return NextResponse.json({ error: 'Konfirmasi import diperlukan' }, { status: 400 })
    }

    const xlsx = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: 'buffer' })

    // ── 1. Read reference data from v9.4 ───
    const allClasses = readClassesSheet(workbook)
    const nicknameMap = readTeachersSheet(workbook)
    const lessonsResult = readLessonsSheet(workbook, nicknameMap)

    // ── 2. Import teachers from v9.4 ───
    const totalTeachers = await importTeachersFromV94(
      workbook,
      lessonsResult.teacherMap,
      supabase,
      xlsx
    )

    // ── 3. Delete existing schedules ───
    const { error: deleteError } = await supabase.from('schedules').delete().neq('id', 0)
    if (deleteError) {
      console.error('Delete schedules error:', deleteError)
    }

    const allRecords: ScheduleRecord[] = []

    // ── 4. Detect file format and process ───
    const hasAvailableTeachers = hasAvailableTeachersFormat(workbook)

    if (hasAvailableTeachers) {
      allRecords.push(
        ...processAvailableTeachersFormat(
          workbook,
          allClasses,
          lessonsResult.teacherToClassesSubjects,
          lessonsResult.teacherNickToClassesSubjects,
          nicknameMap.nicknameToFullname
        )
      )
    } else {
      for (const sheetName of SUBJECT_SHEETS) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue

        const records = processSubjectSheet(sheet, lessonsResult.teacherMap, allClasses)
        allRecords.push(...records)
      }
    }

    // ── 5. Process Leadership sheets ───
    for (const sheetName of LEADERSHIP_SHEETS) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue

      const code = LEADERSHIP_CODE_OF_SHEET[sheetName]
      const participants = lessonsResult.leadershipParticipants.get(code) ?? []

      const records = processLeadershipSheet(sheet, participants, code)
      allRecords.push(...records)
    }

    // ── 6. Process without-teacher sheets ───
    for (const sheetName of WITHOUT_TEACHER_SHEETS) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue

      const records = processWithoutTeacherSheet(sheet, allClasses)
      allRecords.push(...records)
    }

    // ── 7. Batch upsert schedule records ───
    let imported = 0
    if (allRecords.length > 0) {
      const { error: upsertError } = await supabase.from('schedules').upsert(allRecords, {
        onConflict: 'class_name,day,period',
      })

      if (upsertError) {
        return NextResponse.json(
          { error: 'Gagal menyimpan jadwal: ' + upsertError.message },
          { status: 500 }
        )
      }
      imported = allRecords.length
    }

    if (imported === 0) {
      return NextResponse.json(
        {
          error:
            'Tidak ada data jadwal yang berhasil diimport. Pastikan file v9.4.xlsx sesuai format yang diharapkan.',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil import ${totalTeachers} guru & ${imported} slot jadwal dari v9.4.xlsx.`,
      teachers: totalTeachers,
      schedules: imported,
    })
  } catch (error) {
    console.error('Import v9.4 error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

async function importTeachersFromV94(
  workbook: { Sheets: Record<string, unknown>; SheetNames: string[] },
  teacherMap: Map<string, string[]>,
  supabase: ReturnType<typeof createClient>,
  xlsxModule: typeof import('xlsx')
): Promise<number> {
  const sheet = (workbook.Sheets as Record<string, unknown>)['Teachers']
  if (!sheet) return 0

  const rows = xlsxModule.utils.sheet_to_json(
    sheet as Parameters<typeof xlsxModule.utils.sheet_to_json>[0],
    { header: 1 }
  ) as unknown[][]

  const nicknameToMapel = new Map<string, Array<{ mapel: string; kelas: string }>>()

  for (const [key, teachers] of teacherMap) {
    const [kelas, mapel] = key.split('|', 2)
    for (const nick of teachers) {
      if (!nicknameToMapel.has(nick)) {
        nicknameToMapel.set(nick, [])
      }
      nicknameToMapel.get(nick)!.push({ mapel, kelas })
    }
  }

  const importedEmails: string[] = []
  let count = 0

  for (let i = 1; i < rows.length; i++) {
    const name = String(rows[i]?.[1] ?? '').trim()
    const short = String(rows[i]?.[2] ?? '').trim()

    if (name === '') break

    const email = generateEmailFromName(name)
    importedEmails.push(email)

    const mapelData = nicknameToMapel.get(short) ?? []
    const normalizedMapel = normalizeMapel(mapelData)

    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find((u) => u.email === email)

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: 'abbs2024',
      })
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: 'abbs2024',
        email_confirm: true,
      })

      if (createError || !newUser?.user) {
        console.error('Create teacher error:', createError)
        continue
      }
      userId = newUser.user.id
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      name,
      is_admin: false,
      mapel: normalizedMapel,
    })

    if (profileError) {
      console.error('Profile upsert error:', profileError)
    }

    count++
  }

  if (importedEmails.length > 0) {
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', false)

    if (allProfiles) {
      for (const p of allProfiles) {
        const { data: authUser } = await supabase.auth.admin.getUserById(p.id)
        if (authUser?.user?.email && !importedEmails.includes(authUser.user.email)) {
          await supabase.from('profiles').delete().eq('id', p.id)
          await supabase.auth.admin.deleteUser(p.id)
        }
      }
    }
  }

  return count
}
