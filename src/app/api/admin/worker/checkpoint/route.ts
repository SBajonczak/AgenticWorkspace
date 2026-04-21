import { NextResponse } from 'next/server'
import { requireProjectAdmin } from '@/lib/authz'
import { TenantRepository } from '@/db/repositories/tenantRepository'
import { runAgentCycleForTenant } from '@/worker/scheduler'

const MAX_BACKFILL_DAYS = 30

const tenantRepo = new TenantRepository()

function getTenantId(session: { user: { tenantId?: string } }): string | undefined {
  return session.user.tenantId ?? undefined
}

/** GET /api/admin/worker/checkpoint — returns current tenant checkpoint and summary stats */
export async function GET() {
  const { session, error } = await requireProjectAdmin()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account.' }, { status: 409 })
  }

  const state = await tenantRepo.getWorkerCheckpoint(tenantId)

  return NextResponse.json({
    tenantId,
    meetingSyncCheckpointAt: state?.meetingSyncCheckpointAt?.toISOString() ?? null,
    checkpointUpdatedAt: state?.checkpointUpdatedAt?.toISOString() ?? null,
    checkpointUpdatedByUserId: state?.checkpointUpdatedByUserId ?? null,
    checkpointUpdatedByEmail: state?.checkpointUpdatedByEmail ?? null,
    checkpointUpdateReason: state?.checkpointUpdateReason ?? null,
    maxBackfillDays: MAX_BACKFILL_DAYS,
  })
}

/** PUT /api/admin/worker/checkpoint — update tenant checkpoint to rewind sync */
export async function PUT(request: Request) {
  const { session, error } = await requireProjectAdmin()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account.' }, { status: 409 })
  }

  let body: { date?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { date, reason } = body

  let checkpoint: Date | null

  if (date === null || date === undefined || date === '') {
    checkpoint = null
  } else {
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Invalid date value. Please provide an ISO 8601 date string.' }, { status: 422 })
    }
    const minAllowed = new Date(Date.now() - MAX_BACKFILL_DAYS * 24 * 60 * 60 * 1000)
    if (parsed < minAllowed) {
      return NextResponse.json(
        {
          error: `Checkpoint date cannot be more than ${MAX_BACKFILL_DAYS} days in the past.`,
          maxBackfillDays: MAX_BACKFILL_DAYS,
          minAllowedDate: minAllowed.toISOString(),
        },
        { status: 422 }
      )
    }
    const now = new Date()
    if (parsed > now) {
      return NextResponse.json({ error: 'Checkpoint date cannot be in the future.' }, { status: 422 })
    }
    checkpoint = parsed
  }

  await tenantRepo.setWorkerCheckpoint(
    tenantId,
    checkpoint,
    { userId: session.user.id, email: session.user.email },
    reason ?? 'admin-rewind'
  )

  return NextResponse.json({
    success: true,
    meetingSyncCheckpointAt: checkpoint?.toISOString() ?? null,
    message: checkpoint
      ? `Checkpoint set to ${checkpoint.toISOString()}. Next worker cycle will fetch meetings from this date.`
      : 'Checkpoint cleared. Worker will use default sync window.',
  })
}

/** POST /api/admin/worker/checkpoint/backfill — trigger a backfill run for the tenant */
export async function POST(request: Request) {
  const { session, error } = await requireProjectAdmin()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account.' }, { status: 409 })
  }

  let body: { from?: string; to?: string; dryRun?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { from, to, dryRun = false } = body

  if (!from) {
    return NextResponse.json({ error: 'Missing required field: from (ISO 8601 date string).' }, { status: 422 })
  }

  const fromDate = new Date(from)
  if (isNaN(fromDate.getTime())) {
    return NextResponse.json({ error: 'Invalid from date.' }, { status: 422 })
  }

  const toDate = to ? new Date(to) : new Date()
  if (isNaN(toDate.getTime())) {
    return NextResponse.json({ error: 'Invalid to date.' }, { status: 422 })
  }

  const minAllowed = new Date(Date.now() - MAX_BACKFILL_DAYS * 24 * 60 * 60 * 1000)
  if (fromDate < minAllowed) {
    return NextResponse.json(
      {
        error: `Backfill start date cannot be more than ${MAX_BACKFILL_DAYS} days in the past.`,
        maxBackfillDays: MAX_BACKFILL_DAYS,
        minAllowedDate: minAllowed.toISOString(),
      },
      { status: 422 }
    )
  }

  if (fromDate >= toDate) {
    return NextResponse.json({ error: 'from date must be earlier than to date.' }, { status: 422 })
  }

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      message: 'Dry-run: no data was changed. Remove dryRun flag to execute the backfill.',
    })
  }

  const actor = { userId: session.user.id, email: session.user.email }

  const userCount = await runAgentCycleForTenant(tenantId, {
    checkpointOverrideFrom: fromDate,
    windowEndAt: toDate,
    actor,
  })

  return NextResponse.json({
    success: true,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    usersProcessed: userCount,
    message: `Backfill triggered for ${userCount} user(s) in the tenant from ${fromDate.toISOString()} to ${toDate.toISOString()}.`,
  })
}
