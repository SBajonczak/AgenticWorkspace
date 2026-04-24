import { NextResponse } from 'next/server'
import { requireProjectAdmin } from '@/lib/authz'
import { prisma } from '@/db/prisma'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { MeetingProcessor } from '@/agent/meetingProcessor'
import { createLLMClient } from '@/ai/llmClient'
import { TodoRepository } from '@/db/repositories/todoRepository'
import { MeetingMinutesRepository } from '@/db/repositories/meetingMinutesRepository'
import { ProjectStatusRepository } from '@/db/repositories/projectStatusRepository'
import { TicketSyncRepository } from '@/db/repositories/ticketSyncRepository'
import { TenantRepository } from '@/db/repositories/tenantRepository'
import { createTicketProvider, createTicketProviderFromEnv } from '@/tickets/factory'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { UserTokenService } from '@/graph/userTokenService'
import { TranscriptsClient } from '@/graph/transcripts'

interface AnalyzeRequestBody {
  userId?: string
  meetingId?: string
  title?: string
  startTime?: string
  endTime?: string
  organizer?: string
  organizerEmail?: string | null
  participants?: string[]
  force?: boolean
}

function getTenantId(session: { user: { tenantId?: string } }): string | undefined {
  return session.user.tenantId ?? undefined
}

export async function POST(request: Request) {
  const { session, error } = await requireProjectAdmin()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account.' }, { status: 409 })
  }

  const body = (await request.json().catch(() => ({}))) as AnalyzeRequestBody
  const userId = body.userId?.trim()
  const meetingId = body.meetingId?.trim()

  if (!userId || !meetingId || !body.title || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 422 })
  }

  const startTime = new Date(body.startTime)
  const endTime = new Date(body.endTime)
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return NextResponse.json({ error: 'Invalid meeting dates.' }, { status: 422 })
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId,
      accounts: { some: { provider: 'microsoft-entra-id' } },
    },
    select: {
      id: true,
      email: true,
      name: true,
      aadObjectId: true,
      tenant: { select: { azureTenantId: true } },
    },
  })

  if (!targetUser) {
    return NextResponse.json({ error: 'Target user not found for this tenant.' }, { status: 404 })
  }

  const meetingRepo = new MeetingRepository()
  const existing = await meetingRepo.findByMeetingIdAndStartTime(meetingId, startTime)

  if (existing?.tenantId && existing.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Meeting belongs to another tenant.' }, { status: 403 })
  }

  const force = Boolean(body.force)
  if (existing?.processedAt && !force) {
    return NextResponse.json({ error: 'Meeting already analyzed.' }, { status: 409 })
  }

  const syncRepo = new UserSyncStateRepository()
  const tokenService = new UserTokenService(syncRepo)
  const accessToken = await tokenService.getValidAccessTokenForUser(targetUser.id)
  const transcriptsClient = new TranscriptsClient(accessToken, targetUser.id, tokenService)
  const transcript = await transcriptsClient.getTranscript(meetingId)

  if (!transcript) {
    return NextResponse.json({ error: 'No transcript available yet.' }, { status: 422 })
  }

  const tenantRepo = new TenantRepository()
  const tenantConfig = await tenantRepo.getTicketConfig(tenantId)
  const ticketProvider = tenantConfig ? createTicketProvider(tenantConfig) : createTicketProviderFromEnv()

  const processor = new MeetingProcessor(
    createLLMClient(),
    meetingRepo,
    new TodoRepository(),
    new MeetingMinutesRepository(),
    new ProjectStatusRepository(),
    new TicketSyncRepository(),
    ticketProvider
  )

  const organizerEmail = (body.organizerEmail ?? '').toLowerCase() || undefined
  const participants = Array.isArray(body.participants)
    ? body.participants.map((entry) => entry.toLowerCase())
    : organizerEmail
      ? [organizerEmail]
      : []

  const result = await processor.processMeeting(
    meetingId,
    body.title,
    body.organizer ?? organizerEmail ?? 'Unknown',
    organizerEmail,
    startTime,
    endTime,
    transcript,
    participants,
    tenantId,
    {
      oid: targetUser.aadObjectId,
      tid: targetUser.tenant?.azureTenantId ?? null,
      name: targetUser.name ?? targetUser.email,
    },
    {
      indexedForUserId: targetUser.id,
      indexedForUserEmail: targetUser.email,
      indexedByUserId: session.user.id,
      indexedByUserEmail: session.user.email,
      isRecrawl: force && Boolean(existing),
    }
  )

  return NextResponse.json({
    success: true,
    meeting: {
      id: result.meeting.id,
      meetingId: result.meeting.meetingId,
      title: result.meeting.title,
      processedAt: result.meeting.processedAt,
      recrawlCount: result.meeting.recrawlCount,
      lastRecrawlAt: result.meeting.lastRecrawlAt,
    },
    stats: {
      todosCreated: result.todosCreated,
      minutesCreated: result.minutesCreated,
      projectStatusesCreated: result.projectStatusesCreated,
      ticketsSynced: result.ticketsSynced,
      ticketsFailed: result.ticketsFailed,
    },
  })
}
