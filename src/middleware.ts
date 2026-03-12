import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { auth } from './lib/auth'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

// Routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/error',
  '/api/auth',
]

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public routes and static assets
  if (
    isPublicRoute(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)
  ) {
    // Still run i18n middleware for locale-aware routes
    if (!pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
      return intlMiddleware(request)
    }
    return NextResponse.next()
  }

  // Check authentication for protected routes
  const session = await auth()

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
