import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { checkProfileGuard } from '@/features/auth/lib/profile-guard'
import { LANDING_PATH } from '@/features/auth/lib/role-redirect'

type DeferredWrite = { name: string; value: string; options: CookieOptions }

export async function POST(request: Request) {
  let body: { token?: unknown; nonce?: unknown; redirectTo?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, code: 'auth_callback_failed' },
      { status: 400 },
    )
  }

  const token = typeof body.token === 'string' ? body.token : null
  const nonce = typeof body.nonce === 'string' ? body.nonce : null
  const redirectTo =
    typeof body.redirectTo === 'string' && body.redirectTo.startsWith('/')
      ? body.redirectTo
      : null

  if (!token || !nonce) {
    return NextResponse.json(
      { ok: false, code: 'auth_callback_failed' },
      { status: 400 },
    )
  }

  const cookieStore = await cookies()
  const writes = new Map<string, DeferredWrite>()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            writes.set(name, { name, value, options: options ?? {} })
          })
        },
      },
    },
  )

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token,
    nonce,
  })

  if (error || !data?.session) {
    return NextResponse.json(
      { ok: false, code: 'auth_callback_failed' },
      { status: 401 },
    )
  }

  const guard = await checkProfileGuard(supabase, data.session.user.id)
  if (!guard.ok) {
    await supabase.auth.signOut()
    const fail = NextResponse.json(
      { ok: false, code: guard.code },
      { status: 403 },
    )
    for (const { name, value, options } of writes.values()) {
      fail.cookies.set(
        name,
        value,
        options as Parameters<typeof fail.cookies.set>[2],
      )
    }
    return fail
  }

  const target = redirectTo ?? LANDING_PATH
  const response = NextResponse.json({ ok: true, target })
  for (const { name, value, options } of writes.values()) {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    )
  }
  return response
}
