import { NextResponse } from 'next/server'
import { requireProjectAdmin } from '@/lib/authz'
import { MeetingRepository } from '@/db/repositories/meetingRepository'

const meetingRepo = new MeetingRepository()

function getTenantId(session: { user: { tenantId?: string } }): string | undefined {
  return session.user.tenantId ?? undefined
}

/** GET /api/admin/worker/meetings — return indexed meetings with audit info for the tenant */
export async function GET(request: Request) {
  const { session, error } = await requireProjectAdmin()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account.' }, { status: 409 })
  }

  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') ?? undefined
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const limitParam = url.searchParams.get('limit')

  const fromDate = from ? new Date(from) : undefined
  const toDate = to ? new Date(to) : undefined
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 500) : 200

  if (fromDate && isNaN(fromDate.getTime())) {
    return NextResponse.json({ error: 'Invalid from date.' }, { status: 422 })
  }
  if (toDate && isNaN(toDate.getTime())) {
    return NextResponse.json({ error: 'Invalid to date.' }, { status: 422 })
  }

  const meetings = await meetingRepo.listIndexedMeetingsForAdmin({
    tenantId,
    userId,
    from: fromDate,
    to: toDate,
    limit,
  })

  return NextResponse.json({ meetings })
}
