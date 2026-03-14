import { NextResponse } from 'next/server'
import { AgentRunner } from '@/agent/runner'
import { requireAuth } from '@/lib/authz'

export async function POST(request: Request) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const body = await request.json()
    const dryRun = body.dryRun ?? process.env.DRY_RUN === 'true'

    // Use the user's own delegated MS Graph token (captured at sign-in).
    // This uses /me/ paths and requires only delegated permissions.
    const accessToken = (session as typeof session & { msGraphAccessToken?: string }).msGraphAccessToken
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'No Microsoft Graph token in session. Please sign out and sign in again.' },
        { status: 401 }
      )
    }

    // No targetUserId needed – delegated token uses /me/ automatically.
    const runner = new AgentRunner(dryRun, { accessToken })
    const result = await runner.run()

    // Handle both single result and array of results
    const success = Array.isArray(result)
      ? result.every(r => r.success)
      : result.success

    return NextResponse.json(result, {
      status: success ? 200 : 500,
    })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Agent API endpoint. Use POST to trigger agent run.',
    dryRun: process.env.DRY_RUN === 'true',
  })
}
