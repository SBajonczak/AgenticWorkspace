'use client'

import { signIn } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SignInPage() {
  const [callbackUrl, setCallbackUrl] = useState('/dashboard')
  const [forceConsent, setForceConsent] = useState(false)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    setCallbackUrl(searchParams.get('callbackUrl') || '/dashboard')
    setForceConsent(searchParams.get('consent') === 'required')
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="max-w-md w-full text-center shadow-2xl">
        <CardHeader className="pb-2">
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 border border-blue-400/30">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Agentic Workspace</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sign in with your Microsoft 365 account to access meeting insights.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            size="lg"
            className="w-full gap-3 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() =>
              signIn('microsoft-entra-id', {
                callbackUrl,
                ...(forceConsent ? { prompt: 'consent' } : {}),
              })
            }
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.4 2H2v9.4h9.4V2zM22 2h-9.4v9.4H22V2zM11.4 12.6H2V22h9.4v-9.4zM22 12.6h-9.4V22H22v-9.4z" />
            </svg>
            Sign in with Microsoft 365
          </Button>

          <p className="text-xs text-muted-foreground">
            Access is restricted to meeting participants. Only attendees of a meeting can view its data.
          </p>
          {forceConsent && (
            <p className="text-xs text-amber-300">
              Additional Microsoft consent is required. Please grant the requested permissions.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
