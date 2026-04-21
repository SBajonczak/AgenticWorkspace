import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authz'
import { prisma } from '@/db/prisma'
import { runIndexingForMeeting } from '@/worker/scheduler'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userTenantId = session!.user.tenantId
  if (!userTenantId) {
    return NextResponse.json({ error: 'No tenant association.' }, { status: 403 })
  }

  // Verify the meeting belongs to the same tenant and check current state
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    select: { id: true, tenantId: true, processedAt: true, isIndexing: true },
  })

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
  }

  if (meeting.tenantId !== userTenantId) {
    return NextResponse.json({ error: 'Forbidden: Meeting belongs to a different tenant.' }, { status: 403 })
  }

  if (meeting.processedAt) {
    return NextResponse.json({ error: 'Meeting is already indexed.' }, { status: 409 })
  }

  if (meeting.isIndexing) {
    return NextResponse.json({ error: 'Meeting is already being indexed.' }, { status: 409 })
  }

  const meetingDbId = params.id
  const userId = session!.user.id
  const userEmail = session!.user.email

  // Fire-and-forget: runIndexingForMeeting acquires the DB-level atomic lock internally
  runIndexingForMeeting(meetingDbId, userId, userEmail).catch((err) => {
    console.error(`[API][/api/meetings/${meetingDbId}/index] Background indexing failed:`, err)
  })

  return NextResponse.json({ status: 'queued' }, { status: 202 })
}

