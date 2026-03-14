import { NextRequest, NextResponse } from 'next/server'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { getDatabaseProvider } from '@/db/config'
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
  try {
    const { searchParams } = new URL(request.url)
    const kind = parseKind(searchParams.get('kind'))
    const limit = parseLimit(searchParams.get('limit'))

    const meetingRepo = new MeetingRepository()

    const meetings =
      kind === 'completed'
        ? await meetingRepo.findLatestProcessed(limit)
        : kind === 'upcoming'
          ? await meetingRepo.findUpcoming(limit)
          : await meetingRepo.findLatest(limit)

    const items = meetings.map((meeting) => ({
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
      todos: meeting.todos.map((todo) => ({ id: todo.id })),
    }))

    return NextResponse.json({
      meetings: items,
      meta: {
        kind,
        limit,
        provider: getDatabaseProvider(),
      },
    })
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
