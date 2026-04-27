import { NextResponse } from 'next/server'
import { requireProjectAdmin } from '@/lib/authz'
import { prisma } from '@/db/prisma'

function getTenantId(session: { user: { tenantId?: string } }): string | undefined {
  return session.user.tenantId ?? undefined
}

/** GET /api/admin/worker/users — return user sync states for the current tenant */
export async function GET(request: Request) {
  const { session, error } = await requireProjectAdmin()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account.' }, { status: 409 })
  }

  const url = new URL(request.url)
  const onlyNeedsConsent = url.searchParams.get('onlyNeedsConsent') !== '0'

  const limitParam = url.searchParams.get('limit')
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(1, parsedLimit), 500) : 100

  const rows = await prisma.userSyncState.findMany({
    where: {
      user: { tenantId },
      ...(onlyNeedsConsent
        ? {
            OR: [{ consentRequired: true }, { hasRefreshToken: false }],
          }
        : {}),
    },
    orderBy: [{ consentRequired: 'desc' }, { hasRefreshToken: 'asc' }, { updatedAt: 'desc' }],
    take: limit,
    select: {
      userId: true,
      consentRequired: true,
      hasRefreshToken: true,
      lastError: true,
      lastRunAt: true,
      lastSuccessAt: true,
      nextRunAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  const users = rows.map((row) => ({
    userId: row.userId ?? row.user?.id ?? null,
    name: row.user?.name ?? null,
    email: row.user?.email ?? null,
    consentRequired: row.consentRequired,
    hasRefreshToken: row.hasRefreshToken,
    lastError: row.lastError ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }))

  return NextResponse.json({
    users,
    meta: {
      onlyNeedsConsent,
      count: users.length,
    },
  })
}
