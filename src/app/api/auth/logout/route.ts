import { createClient } from '@/utils/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request)
    await supabase.auth.signOut()

    const result = NextResponse.redirect(new URL('/login', request.url), 302)
    response.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        expires: cookie.expires,
        maxAge: cookie.maxAge,
        domain: cookie.domain,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
      })
    })

    return result
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
