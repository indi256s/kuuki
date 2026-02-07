import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

interface Env {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context

  // Skip middleware for static assets
  const url = new URL(request.url)
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff2?|ttf|eot)$/)
  ) {
    return next()
  }

  // If env vars are not set, pass through (dev mode without wrangler)
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return next()
  }

  const response = await next()

  // Collect cookies to set on the response
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const cookieHeader = request.headers.get('Cookie') ?? ''
        return parseCookieHeader(cookieHeader)
      },
      setAll(cookies) {
        cookiesToSet.push(...cookies)
      },
    },
  })

  // This will refresh the session if the access token is expired
  // The refreshed tokens are stored via setAll above
  await supabase.auth.getUser()

  // Clone response and set updated cookies
  const newResponse = new Response(response.body, response)

  for (const cookie of cookiesToSet) {
    newResponse.headers.append(
      'Set-Cookie',
      serializeCookieHeader(cookie.name, cookie.value, {
        ...cookie.options,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      })
    )
  }

  return newResponse
}
