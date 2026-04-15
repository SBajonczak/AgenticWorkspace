import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import NextAuth from 'next-auth'
import type { Session } from 'next-auth'
import { authConfig } from './lib/auth.config'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)
const { auth } = NextAuth(authConfig)

// Routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/error',
  '/api/auth',
]

function normalizePathname(pathname: string): string {
  for (const locale of routing.locales) {
    const localePrefix = `/${locale}`
    if (pathname === localePrefix) {
      return '/'
    }
    if (pathname.startsWith(`${localePrefix}/`)) {
      return pathname.slice(localePrefix.length)
    }
  }

  return pathname
}

function isPublicRoute(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname)
  return publicRoutes.some(
    (route) => normalizedPathname === route || normalizedPathname.startsWith(route + '/')
  )
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const normalizedPathname = normalizePathname(pathname)

  // Always allow public routes and static assets
  if (
    isPublicRoute(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)
  ) {
    // Still run i18n middleware for locale-aware routes
    if (
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/_next') &&
      !normalizedPathname.startsWith('/auth/') &&
      normalizedPathname !== '/auth'
    ) {
      return intlMiddleware(request)
    }
    return NextResponse.next()
  }

  // Check authentication for protected routes
  let session: Session | null = null
  try {
    session = (await auth()) as Session | null
  } catch {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.delete('authjs.session-token')
      response.cookies.delete('__Secure-authjs.session-token')
      response.cookies.delete('next-auth.session-token')
      response.cookies.delete('__Secure-next-auth.session-token')
      return response
    }

    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', request.url)
    const response = NextResponse.redirect(signInUrl)
    response.cookies.delete('authjs.session-token')
    response.cookies.delete('__Secure-authjs.session-token')
    response.cookies.delete('next-auth.session-token')
    response.cookies.delete('__Secure-next-auth.session-token')
    return response
  }

  if (!session?.user) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // UI routes redirect to sign-in
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(signInUrl)
  }

  // Run i18n middleware for locale-aware UI routes
  if (!pathname.startsWith('/api/')) {
    return intlMiddleware(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
