import { NextResponse } from 'next/server'
import { requireProjectAdmin } from '@/lib/authz'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { MeetingProcessor } from '@/agent/meetingProcessor'
import { LLMClient } from '@/ai/llmClient'
import { createLLMClient } from '@/ai/llmClient'
import { TodoRepository } from '@/db/repositories/todoRepository'
import { MeetingMinutesRepository } from '@/db/repositories/meetingMinutesRepository'
import { ProjectStatusRepository } from '@/db/repositories/projectStatusRepository'
import { TicketSyncRepository } from '@/db/repositories/ticketSyncRepository'
import { TenantRepository } from '@/db/repositories/tenantRepository'
import { createTicketProvider, createTicketProviderFromEnv } from '@/tickets/factory'

function getTenantId(session: { user: { tenantId?: string } }): string | undefined {
  return session.user.tenantId ?? undefined
}

/** POST /api/admin/worker/meetings/[id]/recrawl — replace-mode reprocess for a single meeting */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireProjectAdmin()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account.' }, { status: 409 })
  }

  const { id } = await context.params

  const meetingRepo = new MeetingRepository()
  const meeting = await meetingRepo.findByIdAndTenant(id, tenantId)

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
  }

  if (!meeting.transcript) {
    return NextResponse.json(
      { error: 'Meeting has no transcript. Recrawl requires a stored transcript.' },
      { status: 422 }
    )
  }

  const tenantRepo = new TenantRepository()
  const tenantConfig = await tenantRepo.getTicketConfig(tenantId)
  const ticketProvider = tenantConfig ? createTicketProvider(tenantConfig) : createTicketProviderFromEnv()

  const llmClient = createLLMClient()
  const processor = new MeetingProcessor(
    llmClient,
    meetingRepo,
    new TodoRepository(),
    new MeetingMinutesRepository(),
    new ProjectStatusRepository(),
    new TicketSyncRepository(),
    ticketProvider
  )

  const result = await processor.reprocessMeeting(meeting.meetingId, {
    indexedByUserId: session.user.id,
    indexedByUserEmail: session.user.email,
  })

  return NextResponse.json({
    success: true,
    meetingId: id,
    title: result.meeting.title,
    todosCreated: result.todosCreated,
    projectStatusesCreated: result.projectStatusesCreated,
    minutesCreated: result.minutesCreated,
    recrawlCount: (result.meeting as any).recrawlCount ?? null,
    lastRecrawlAt: (result.meeting as any).lastRecrawlAt ?? null,
  })
}
