import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authz'
import { runAgentCycleForUser } from '@/worker/scheduler'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'

export async function POST(request: Request) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    await request.json().catch(() => ({}))
    const userId = session.user.id
    const syncRepo = new UserSyncStateRepository()
    const syncState = await syncRepo.getByUserId(userId)

    if (syncState?.consentRequired || !syncState?.hasRefreshToken) {
      return NextResponse.json(
        {
          success: false,
          code: 'auth_reauth_required',
          error: 'Microsoft consent or refresh token missing. Please sign in again and grant consent.',
        },
        { status: 409 }
      )
    }

    await runAgentCycleForUser(userId)

    return NextResponse.json({ success: true, message: 'Meeting processing triggered successfully.' })
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
    message: 'Agent API endpoint. Use POST to trigger immediate processing for the current user.',
    dryRun: process.env.DRY_RUN === 'true',
  })
}
