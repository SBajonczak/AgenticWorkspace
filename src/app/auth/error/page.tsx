'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const errorMessages: Record<string, string> = {
  Configuration: 'Server configuration error. Please contact your administrator.',
  AccessDenied: 'Access denied. Your account is not authorized to use this application.',
  Verification: 'The verification link is no longer valid. Please request a new one.',
  Default: 'An unexpected error occurred during sign in.',
}

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'Default'
  const message = errorMessages[error] || errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-white/10 backdrop-blur-md border border-red-400/30 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border border-red-400/30 mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Authentication Error</h1>
          <p className="text-slate-400 text-sm">{message}</p>
        </div>

        <Link
          href="/auth/signin"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors duration-200"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
