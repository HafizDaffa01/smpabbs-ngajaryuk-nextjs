import { createClient } from '@supabase/supabase-js'
import readline from 'readline'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials. Please check your .env.local file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function main() {
  console.log('\n========================================')
  console.log('  EDIT USER - NgajarYuk')
  console.log('========================================\n')

  try {
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('Gagal memuat daftar user:', authError.message)
      rl.close()
      process.exit(1)
    }

    const users = authUsers.users

    if (users.length === 0) {
      console.log('Belum ada user di database.')
      rl.close()
      process.exit(0)
    }

    const { data: profiles } = await supabase.from('profiles').select('id, is_admin, phone_num')
    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

    console.log('Daftar User:')
    console.log('─'.repeat(90))
    for (let i = 0; i < users.length; i++) {
      const u = users[i]
      const profile = profileMap.get(u.id)
      const no = String(i + 1).padEnd(4)
      const name = (u.user_metadata?.name || '-').padEnd(25)
      const email = (u.email || '-').padEnd(30)
      const role = profile?.is_admin ? 'ADMIN' : 'GURU'
      const rolePad = role.padEnd(10)
      const phone = (profile?.phone_num || '-').padEnd(15)
      const created = u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID') : '-'
      const createdPad = created.padEnd(12)
      console.log(`${no} ${name} ${email} ${rolePad} ${phone} ${createdPad}`)
    }
    console.log('─'.repeat(90))

    const userIndexStr = await question('\nPilih nomor user yang ingin diedit: ')
    const userIndex = parseInt(userIndexStr) - 1

    if (isNaN(userIndex) || userIndex < 0 || userIndex >= users.length) {
      console.error('Nomor user tidak valid!')
      rl.close()
      process.exit(1)
    }

    const selectedUser = users[userIndex]
    const currentProfile = profileMap.get(selectedUser.id)
    const currentName = selectedUser.user_metadata?.name || ''
    const currentEmail = selectedUser.email || ''
    const currentRole = currentProfile?.is_admin ? 'admin' : 'teacher'
    const currentPhone = currentProfile?.phone_num || ''

    console.log(`\nEditing user: ${currentName} (${currentEmail})`)
    console.log('Kosongkan field jika tidak ingin mengubahnya.\n')

    const nameInput = await question(`Nama lengkap [${currentName}]: `)
    const emailInput = await question(`Email [${currentEmail}]: `)
    const roleInput = await question(`Role (admin/teacher) [${currentRole}]: `)
    const phoneInput = await question(`No. WhatsApp [${currentPhone}]: `)
    const passwordInput = await question('Password baru (kosongkan jika tidak ingin mengubah): ')

    const updates: Record<string, unknown> = {}

    if (nameInput.trim()) {
      updates.name = nameInput.trim()
    }

    if (emailInput.trim() && emailInput.trim() !== currentEmail) {
      updates.email = emailInput.trim()
    }

    let newRole = currentRole
    if (roleInput.trim()) {
      const role = roleInput.trim().toLowerCase()
      if (role === 'admin' || role === 'teacher') {
        newRole = role
      } else {
        console.error('Role harus "admin" atau "teacher"!')
        rl.close()
        process.exit(1)
      }
    }

    const phoneNum = phoneInput.trim() || null
    const newPassword = passwordInput.trim() || null

    console.log('\nMenyimpan perubahan...\n')

    const authUpdates: Record<string, unknown> = {}
    if (Object.keys(updates).length > 0) {
      authUpdates.email = updates.email as string | undefined
      authUpdates.user_metadata = updates.name ? { name: updates.name } : undefined
    }
    if (newPassword) {
      authUpdates.password = newPassword
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(selectedUser.id, authUpdates)

      if (authError) {
        console.error('Gagal update auth user:', authError.message)
      } else {
        console.log('✓ Auth user berhasil diupdate')
      }
    }

    const profileUpdates: Record<string, unknown> = {}
    if (nameInput.trim()) profileUpdates.name = nameInput.trim()
    if (emailInput.trim()) profileUpdates.email = emailInput.trim()
    if (newRole !== currentRole) profileUpdates.is_admin = newRole === 'admin'
    if (phoneInput.trim()) profileUpdates.phone_num = phoneNum

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: selectedUser.id, ...profileUpdates }, { onConflict: 'id' })

      if (profileError) {
        console.error('Gagal update profile:', profileError.message)
      } else {
        console.log('✓ Profile berhasil diupdate')
      }
    }

    console.log('\n✓ User berhasil diedit!')
    console.log(`  Nama   : ${nameInput.trim() || currentName}`)
    console.log(`  Email  : ${emailInput.trim() || currentEmail}`)
    console.log(`  Role   : ${newRole}`)
    console.log(`  No. WA : ${phoneNum || '-'}`)
    console.log(`  Password: ${newPassword ? '✓ Berhasil diubah' : '(tidak diubah)'}`)
  } catch (err) {
    console.error('Terjadi kesalahan:', err)
    process.exit(1)
  } finally {
    rl.close()
  }
}

main()
