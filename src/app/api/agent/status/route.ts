import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authz'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const syncRepo = new UserSyncStateRepository()
    const syncState = await syncRepo.getByUserId(session.user.id)

    return NextResponse.json({
      isProcessing: syncState?.isProcessing ?? false,
      nextRunAt: syncState?.nextRunAt?.toISOString() ?? null,
      lastRunAt: syncState?.lastRunAt?.toISOString() ?? null,
      lastSuccessAt: syncState?.lastSuccessAt?.toISOString() ?? null,
      consentRequired: syncState?.consentRequired ?? false,
      hasRefreshToken: syncState?.hasRefreshToken ?? false,
      lastError: syncState?.lastError ?? null,
    })
  } catch (err) {
    console.error('Failed to load agent status:', err)
    return NextResponse.json(
      {
        error: 'Failed to load agent status',
      },
      { status: 500 }
    )
  }
}
