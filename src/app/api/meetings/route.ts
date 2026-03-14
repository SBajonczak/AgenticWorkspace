import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../lib/auth'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { MeetingStatus } from '@/types/meetings'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

type MeetingsKind = 'all' | 'completed' | 'upcoming'

function parseKind(value: string | null): MeetingsKind {
  if (value === 'completed' || value === 'upcoming') {
    return value
  }

  return 'all'
}

function parseLimit(value: string | null): number {
  const parsed = value ? parseInt(value, 10) : DEFAULT_LIMIT

  if (isNaN(parsed) || parsed < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(parsed, MAX_LIMIT)
}

function getMeetingStatus(startTime: Date, processedAt: Date | null): MeetingStatus {
  if (processedAt) {
    return 'completed'
  }

  if (startTime.getTime() > Date.now()) {
    return 'upcoming'
  }

  return 'cancelled'
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (session.user as any).tenantId as string | undefined
  const userEmail = session.user.email?.toLowerCase()

  try {
    const { searchParams } = request?.url
      ? new URL(request.url)
      : new URL('http://localhost/api/meetings')

    const kind = parseKind(searchParams.get('kind'))
    const limit = parseLimit(searchParams.get('limit') ?? '50')

    const meetingRepo = new MeetingRepository()

    const meetings =
      kind === 'completed'
        ? await meetingRepo.findLatestProcessed(limit, tenantId, userEmail)
        : kind === 'upcoming'
          ? await meetingRepo.findUpcoming(limit, new Date(), tenantId, userEmail)
          : await meetingRepo.findLatest(limit, tenantId, userEmail)

    const result = meetings.map((meeting) => ({
      id: meeting.id,
      meetingId: meeting.meetingId,
      title: meeting.title,
      organizer: meeting.organizer,
      organizerEmail: meeting.organizerEmail,
      startTime: meeting.startTime.toISOString(),
      endTime: meeting.endTime.toISOString(),
      summary: meeting.summary,
      processedAt: meeting.processedAt?.toISOString() ?? null,
      status: getMeetingStatus(meeting.startTime, meeting.processedAt),
      todoCount: meeting.todos.length,
      syncedCount: meeting.todos.reduce((count, todo) => {
        const sync = todo.ticketSync as { status?: string } | null | undefined
        return count + (sync?.status === 'synced' ? 1 : 0)
      }, 0),
      todos: meeting.todos.map((todo) => ({ id: todo.id })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch meetings:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch meetings',
      },
      { status: 500 }
    )
  }
}
