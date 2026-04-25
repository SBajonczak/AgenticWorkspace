import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../lib/auth'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { MeetingStatus } from '@/types/meetings'
import { prisma } from '@/db/prisma'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

type MeetingsKind = 'all' | 'completed' | 'upcoming'
type MeetingsScope = 'user' | 'tenant'
type IndexingStatus = 'not_indexed' | 'indexed' | 'processing'

function parseKind(value: string | null): MeetingsKind {
  if (value === 'completed' || value === 'upcoming') {
    return value
  }

  return 'all'
}

function parseScope(value: string | null): MeetingsScope {
  return value === 'tenant' ? 'tenant' : 'user'
}

function parseIndexingStatus(value: string | null): IndexingStatus | undefined {
  if (value === 'not_indexed' || value === 'indexed' || value === 'processing') return value
  return undefined
}

function parseLimit(value: string | null): number {
  const parsed = value ? parseInt(value, 10) : DEFAULT_LIMIT

  if (isNaN(parsed) || parsed < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(parsed, MAX_LIMIT)
}

function getMeetingStatus(startTime: Date, processedAt: Date | null, isIndexing: boolean): MeetingStatus {
  if (isIndexing) return 'processing'
  if (processedAt) return 'completed'
  if (startTime.getTime() > Date.now()) return 'upcoming'
  return 'cancelled'
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let tenantId = (session.user as any).tenantId as string | undefined
  const userEmail = session.user.email?.toLowerCase()

  // Fallback: if tenantId is not in the session JWT (e.g. stale session from before tenant
  // association was written into the token), look it up directly from the database.
  if (!tenantId && session.user.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    })
    tenantId = dbUser?.tenantId ?? undefined
    if (tenantId) {
      console.warn('[meetings] tenantId missing from session JWT, resolved from DB for user', session.user.id)
    }
  }

  try {
    const searchParams = request.nextUrl.searchParams

    const kind = parseKind(searchParams.get('kind'))
    const scope = parseScope(searchParams.get('scope'))
    const limit = parseLimit(searchParams.get('limit') ?? '50')
    const nameSearch = searchParams.get('nameSearch') ?? undefined
    const hasTranscriptParam = searchParams.get('hasTranscript')
    const hasTranscript =
      hasTranscriptParam === 'true' ? true : hasTranscriptParam === 'false' ? false : undefined
    const indexingStatus = parseIndexingStatus(searchParams.get('indexingStatus'))

    const meetingRepo = new MeetingRepository()

    let meetings: Awaited<ReturnType<typeof meetingRepo.findLatest>>

    if (scope === 'tenant') {
      if (!tenantId) {
        return NextResponse.json({ error: 'No tenant association found.' }, { status: 403 })
      }
      meetings = await meetingRepo.findAllForTenant(tenantId, { nameSearch, hasTranscript, indexingStatus }, limit)
    } else {
      meetings =
        kind === 'completed'
          ? await meetingRepo.findLatestProcessed(limit, tenantId, userEmail)
          : kind === 'upcoming'
            ? await meetingRepo.findUpcoming(limit, new Date(), tenantId, userEmail)
            : await meetingRepo.findLatest(limit, tenantId, userEmail)
    }

    const result = meetings.map((meeting) => {
      const isIndexing = (meeting as any).isIndexing === true
      return {
        id: meeting.id,
        meetingId: meeting.meetingId,
        title: meeting.title,
        organizer: meeting.organizer,
        organizerEmail: meeting.organizerEmail,
        startTime: meeting.startTime.toISOString(),
        endTime: meeting.endTime.toISOString(),
        summary: meeting.summary,
        processedAt: meeting.processedAt?.toISOString() ?? null,
        isIndexing,
        hasTranscript: meeting.transcript != null,
        indexingStatus: isIndexing ? 'processing' : meeting.processedAt ? 'indexed' : 'not_indexed',
        status: getMeetingStatus(meeting.startTime, meeting.processedAt, isIndexing),
        todoCount: meeting.todos.length,
        syncedCount: meeting.todos.reduce((count, todo) => {
          const sync = todo.ticketSync as { status?: string } | null | undefined
          return count + (sync?.status === 'synced' ? 1 : 0)
        }, 0),
        todos: meeting.todos.map((todo) => ({ id: todo.id })),
      }
    })

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

