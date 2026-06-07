import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/', '/acceso-denegado']

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const email = req.auth.user?.email ?? ''
  const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)
  if (allowed.length > 0 && !allowed.includes(email)) {
    return NextResponse.redirect(new URL('/acceso-denegado', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
