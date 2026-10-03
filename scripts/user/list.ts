import { createClient } from '@supabase/supabase-js'
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

async function main() {
  console.log('\n========================================')
  console.log('  DAFTAR USER - NgajarYuk')
  console.log('========================================\n')

  try {
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('Gagal memuat daftar user:', authError.message)
      process.exit(1)
    }

    const users = authUsers.users

    if (users.length === 0) {
      console.log('Belum ada user di database.')
      process.exit(0)
    }

    const { data: profiles } = await supabase.from('profiles').select('id, is_admin, phone_num')

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || [])

    console.log(`Total: ${users.length} user\n`)

    console.log('─'.repeat(90))
    console.log(
      `${'NO'.padEnd(4)} ${'NAMA'.padEnd(25)} ${'EMAIL'.padEnd(30)} ${'ROLE'.padEnd(10)} ${'NO. WA'.padEnd(15)} ${'DIBUAT'.padEnd(12)}`
    )
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
  } catch (err) {
    console.error('Terjadi kesalahan:', err)
    process.exit(1)
  }
}

main()
