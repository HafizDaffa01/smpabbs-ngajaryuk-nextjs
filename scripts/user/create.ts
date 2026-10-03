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
  console.log('  BUAT USER BARU - NgajarYuk')
  console.log('========================================\n')

  const name = await question('Nama lengkap: ')
  if (!name.trim()) {
    console.error('Nama tidak boleh kosong!')
    rl.close()
    process.exit(1)
  }

  const roleInput = await question('Role (admin/teacher): ')
  const role = roleInput.trim().toLowerCase()
  if (role !== 'admin' && role !== 'teacher') {
    console.error('Role harus "admin" atau "teacher"!')
    rl.close()
    process.exit(1)
  }

  const email = await question('Email: ')
  if (!email.trim() || !email.includes('@')) {
    console.error('Email tidak valid!')
    rl.close()
    process.exit(1)
  }

  const password = await question('Password: ')
  if (!password.trim() || password.length < 6) {
    console.error('Password harus minimal 6 karakter!')
    rl.close()
    process.exit(1)
  }

  const phone = await question('No. WhatsApp (opsional): ')

  console.log('\nMembuat user...\n')

  try {
    let userId: string

    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers.users.find((u) => u.email === email)

    if (existingUser) {
      console.log(`Email ${email} sudah terdaftar di Auth.`)
      const useExisting = await question('Gunakan akun yang sudah ada dan buat/update profil? (y/N): ')
      if (useExisting.trim().toLowerCase() !== 'y') {
        console.log('Dibatalkan.')
        rl.close()
        process.exit(0)
      }
      userId = existingUser.id
    } else {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      })

      if (authError) {
        console.error('Gagal membuat user:', authError.message)
        rl.close()
        process.exit(1)
      }

      if (!authData.user) {
        console.error('Gagal membuat user: data user kosong')
        rl.close()
        process.exit(1)
      }

      userId = authData.user.id
    }

    const profileData: Record<string, unknown> = {
      id: userId,
      name,
      email,
    }

    if (role === 'admin') {
      profileData.is_admin = true
    }

    const phoneNum = phone.trim() || null
    if (phoneNum) {
      profileData.phone_num = phoneNum
    }

    const { error: profileError } = await supabase.from('profiles').upsert(profileData, { onConflict: 'id' })

    if (profileError) {
      console.error('Gagal insert/update profile:', profileError.message)
      console.log('\nUser Auth ID:', userId)
      console.log('\nPastikan tabel profiles memiliki kolom:')
      console.log('  - id (uuid, primary key)')
      console.log('  - name (text)')
      console.log('  - email (text)')
      console.log('  - phone_num (text, nullable)')
      console.log('  - is_admin (boolean, default false)')
      console.log('\nJalankan SQL ini di Supabase Dashboard -> SQL Editor:')
      console.log('CREATE TABLE IF NOT EXISTS profiles (')
      console.log('  id UUID PRIMARY KEY REFERENCES auth.users(id),')
      console.log('  name TEXT NOT NULL,')
      console.log('  email TEXT,')
      console.log('  phone_num TEXT,')
      console.log('  is_admin BOOLEAN DEFAULT false,')
      console.log('  mapel JSONB,')
      console.log('  created_at TIMESTAMP DEFAULT NOW(),')
      console.log('  updated_at TIMESTAMP DEFAULT NOW()')
      console.log(');')
    } else {
      console.log('✓ User berhasil dibuat/diupdate!')
      console.log(`  Nama   : ${name}`)
      console.log(`  Email  : ${email}`)
      console.log(`  Role   : ${role}`)
      console.log(`  No. WA : ${phoneNum || '-'}`)
      console.log(`  User ID: ${userId}`)
    }
  } catch (err) {
    console.error('Terjadi kesalahan:', err)
  } finally {
    rl.close()
  }
}

main()
