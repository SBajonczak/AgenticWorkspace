import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authz'
import { prisma } from '@/db/prisma'
import { UserTokenService } from '@/graph/userTokenService'

function normalizeQuery(value: string | null): string {
  return (value ?? '').trim()
}

function keyForIdentity(tid: string, oid: string): string {
  return `${tid}:${oid}`
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  let tenantId = session.user.tenantId
  const azureTid = session.user.azureTid

  // Fresh sessions may have azureTid already, while tenantId is not yet present in the session token.
  // Resolve tenantId from azure tenant id to keep user search functional right after sign-in.
  if (!tenantId && azureTid) {
    const tenantFromAzureTid = await prisma.tenant.findUnique({
      where: { azureTenantId: azureTid },
      select: { id: true },
    })

    if (tenantFromAzureTid?.id) {
      tenantId = tenantFromAzureTid.id

      // Best-effort backfill so subsequent requests can use session/user tenant association consistently.
      if (session.user.id) {
        try {
          await prisma.user.updateMany({
            where: { id: session.user.id, tenantId: null },
            data: { tenantId },
          })
        } catch (persistError) {
          console.warn('[api/tenants/users] Failed to backfill user tenantId', persistError)
        }
      }
    }
  }

  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account' }, { status: 400 })
  }

  const query = normalizeQuery(req.nextUrl.searchParams.get('q'))
  const localLimit = 25

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { azureTenantId: true },
  })

  if (!tenant?.azureTenantId) {
    return NextResponse.json({ users: [] })
  }

  const localUsers = await prisma.user.findMany({
    where: {
      tenantId,
      aadObjectId: { not: null },
      ...(query.length > 0
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      aadObjectId: true,
      name: true,
      email: true,
    },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    take: localLimit,
  })

  const merged = new Map<string, {
    userId: string | null
    oid: string
    tid: string
    displayName: string
    email: string | null
    source: 'local' | 'graph'
    canAssign: boolean
  }>()

  for (const user of localUsers) {
    if (!user.aadObjectId) continue
    const key = keyForIdentity(tenant.azureTenantId, user.aadObjectId)
    merged.set(key, {
      userId: user.id,
      oid: user.aadObjectId,
      tid: tenant.azureTenantId,
      displayName: user.name ?? user.email ?? user.aadObjectId,
      email: user.email,
      source: 'local',
      canAssign: true,
    })
  }

  if (query.length >= 3 && session.user.id) {
    try {
      const tokenService = new UserTokenService()
      const graphUsers = await tokenService.searchPeopleForUser(session.user.id, query, 10)

      for (const user of graphUsers) {
        const key = keyForIdentity(tenant.azureTenantId, user.oid)
        if (merged.has(key)) continue

        merged.set(key, {
          userId: null,
          oid: user.oid,
          tid: tenant.azureTenantId,
          displayName: user.displayName,
          email: user.email,
          source: 'graph',
          canAssign: false,
        })
      }
    } catch (searchError) {
      console.warn('[api/tenants/users] Graph search failed', searchError)
    }
  }

  return NextResponse.json({
    users: [...merged.values()],
    graphSearchActivated: query.length >= 3,
  })
}
