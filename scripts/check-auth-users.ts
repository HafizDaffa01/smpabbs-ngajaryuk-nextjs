import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data } = await supabase.auth.admin.listUsers()
  console.log('Auth users count:', data.users.length)
  data.users.forEach((u: any) => {
    console.log(` - ${u.email} (${u.id}) confirmed=${!!u.email_confirmed_at}`)
  })
}
main()
