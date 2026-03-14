'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const errorMessages: Record<string, string> = {
  Configuration: 'Configuration error during authentication. Ask an administrator to check server logs for NextAuth/Azure details.',
  AccessDenied: 'Access denied. Your account is not authorized to use this application.',
  Verification: 'The verification link is no longer valid. Please request a new one.',
  OAuthSignin: 'Failed to start the OAuth sign-in flow. Please try again.',
  OAuthCallback: 'OAuth callback failed. This often indicates consent, tenant, or redirect URI issues.',
  OAuthCreateAccount: 'Could not create or link your account after OAuth sign-in.',
  OAuthAccountNotLinked: 'This email is already linked to another sign-in method.',
  Callback: 'Authentication callback failed unexpectedly.',
  SessionRequired: 'You must sign in to continue.',
  Signin: 'Sign-in failed unexpectedly. Please try again.',
  Default: 'An unexpected error occurred during sign in.',
}

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'Default'
  const message = errorMessages[error] || errorMessages.Default
  const correlationId = searchParams.get('correlation_id') || searchParams.get('correlationId')
  const traceId = searchParams.get('trace_id') || searchParams.get('traceId')
  const tenant = searchParams.get('tenant')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Card className="max-w-md w-full text-center shadow-2xl border-destructive/30">
        <CardHeader className="pb-2">
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/20 border border-destructive/30">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Authentication Error</h1>
          <p className="text-muted-foreground text-sm mt-1">{message}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-left text-xs text-muted-foreground">
            <p className="mb-1">
              <span className="text-muted-foreground/70">Error code:</span>{' '}
              <span className="font-mono text-foreground">{error}</span>
            </p>
            {correlationId && (
              <p className="mb-1 break-all">
                <span className="text-muted-foreground/70">Correlation ID:</span>{' '}
                <span className="font-mono text-foreground">{correlationId}</span>
              </p>
            )}
            {traceId && (
              <p className="mb-1 break-all">
                <span className="text-muted-foreground/70">Trace ID:</span>{' '}
                <span className="font-mono text-foreground">{traceId}</span>
              </p>
            )}
            {tenant && (
              <p className="break-all">
                <span className="text-muted-foreground/70">Tenant hint:</span>{' '}
                <span className="font-mono text-foreground">{tenant}</span>
              </p>
            )}
            <p className="mt-2 text-muted-foreground/60">
              Share these values with an admin so the exact Microsoft Entra sign-in failure can be found in server logs.
            </p>
          </div>

          <Link
            href="/auth/signin"
            className={cn(buttonVariants(), 'w-full bg-blue-600 hover:bg-blue-700 text-white')}
          >
            Back to Sign In
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
