import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Ensure profile exists for OAuth users
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single()
      if (!profile) {
        const email = data.user.email || ''
        const username =
          data.user.user_metadata?.preferred_username ||
          email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
        await supabase.from('profiles').insert({
          id: data.user.id,
          username,
          display_name:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            username,
          avatar_url: data.user.user_metadata?.avatar_url || null,
        })
      }
      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
