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
  console.log('  HAPUS USER - NgajarYuk')
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

    const userIndexStr = await question('\nPilih nomor user yang ingin dihapus: ')
    const userIndex = parseInt(userIndexStr) - 1

    if (isNaN(userIndex) || userIndex < 0 || userIndex >= users.length) {
      console.error('Nomor user tidak valid!')
      rl.close()
      process.exit(1)
    }

    const selectedUser = users[userIndex]
    const profile = profileMap.get(selectedUser.id)
    const name = selectedUser.user_metadata?.name || selectedUser.email

    const confirmStr = await question(`\nApakah Anda yakin ingin menghapus user "${name}"? (y/N): `)

    if (confirmStr.trim().toLowerCase() !== 'y') {
      console.log('Dibatalkan.')
      rl.close()
      process.exit(0)
    }

    console.log('\nMenghapus user...\n')

    const { error: profileError } = await supabase.from('profiles').delete().eq('id', selectedUser.id)

    if (profileError) {
      console.warn('Peringatan: Gagal hapus profile:', profileError.message)
    } else {
      console.log('✓ Profile berhasil dihapus')
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(selectedUser.id)

    if (deleteError) {
      console.error('Gagal hapus auth user:', deleteError.message)
      console.log('\nUser ID:', selectedUser.id)
      rl.close()
      process.exit(1)
    }

    console.log('✓ Auth user berhasil dihapus')
    console.log(`\nUser "${name}" telah dihapus permanen.`)
  } catch (err) {
    console.error('Terjadi kesalahan:', err)
    process.exit(1)
  } finally {
    rl.close()
  }
}

main()
