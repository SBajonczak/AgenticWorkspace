import { NextResponse } from 'next/server'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { requireMeetingParticipant } from '@/lib/authz'
import { createLLMClient } from '@/ai/llmClient'
import {
  MeetingPreparationAgendaItem,
  MeetingPreparationResponse,
} from '@/types/meetings'

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

function parseDecisions(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function buildFallbackAgenda(input: {
  decisions: string[]
  openTodoTitles: string[]
  hasConflicts: boolean
}): MeetingPreparationAgendaItem[] {
  const agenda: MeetingPreparationAgendaItem[] = []

  for (const decision of input.decisions.slice(0, 2)) {
    agenda.push({
      title: `Follow-up on decision: ${decision}`,
      rationale: 'Based on outcomes from previous related meetings.',
      priority: 'high',
      source: 'history',
    })
  }

  for (const todoTitle of input.openTodoTitles.slice(0, 3)) {
    agenda.push({
      title: `Status update: ${todoTitle}`,
      rationale: 'Open action item from previous meetings.',
      priority: 'medium',
      source: 'history',
    })
  }

  if (input.hasConflicts) {
    agenda.unshift({
      title: 'Resolve scheduling conflict before meeting start',
      rationale: 'Another meeting overlaps with this time slot.',
      priority: 'high',
      source: 'conflict',
    })
  }

  if (agenda.length === 0) {
    agenda.push({
      title: 'Define desired outcomes for this meeting',
      rationale: 'No historical context found. Start with explicit objectives.',
      priority: 'medium',
      source: 'history',
    })
  }

  return agenda.slice(0, 8)
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireMeetingParticipant(params.id)
    if (error) return error

    const tenantId = (session.user as { tenantId?: string }).tenantId
    const userEmail = session.user.email.toLowerCase()

    const meetingRepo = new MeetingRepository()
    const meeting = await meetingRepo.findById(params.id)

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const relatedMeetings = await meetingRepo.findRelatedPastMeetings({
      title: meeting.title,
      organizerEmail: meeting.organizerEmail,
      before: meeting.startTime,
      excludeInternalMeetingId: meeting.id,
      tenantId,
      userEmail,
      limit: 5,
    })

    const upcomingMeetings = await meetingRepo.findUpcoming(30, new Date(), tenantId, userEmail)
    const conflicts = upcomingMeetings
      .filter(
        (candidate) =>
          candidate.id !== meeting.id &&
          overlaps(candidate.startTime, candidate.endTime, meeting.startTime, meeting.endTime)
      )
      .map((conflict) => ({
        id: conflict.id,
        title: conflict.title,
        startTime: conflict.startTime.toISOString(),
        endTime: conflict.endTime.toISOString(),
      }))

    const relatedPayload = relatedMeetings.map((relatedMeeting) => ({
      id: relatedMeeting.id,
      title: relatedMeeting.title,
      startTime: relatedMeeting.startTime.toISOString(),
      summary: relatedMeeting.summary,
      decisions: parseDecisions(relatedMeeting.decisions),
      openTodos: relatedMeeting.todos
        .filter((todo) => todo.status !== 'done')
        .map((todo) => ({
          id: todo.id,
          title: todo.title,
          assigneeHint: todo.assigneeHint,
          status: todo.status,
        })),
      projectStatuses: relatedMeeting.projectStatuses.map((status) => ({
        projectName: status.projectName,
        status: status.status,
        summary: status.summary,
      })),
    }))

    const flattenedDecisions = relatedPayload.flatMap((meetingItem) => meetingItem.decisions)
    const flattenedOpenTodoTitles = relatedPayload.flatMap((meetingItem) =>
      meetingItem.openTodos.map((todo) => todo.title)
    )

    let preparedAgenda: MeetingPreparationAgendaItem[] = []

    try {
      const llmClient = createLLMClient()
      preparedAgenda = await llmClient.prepareMeetingAgenda(
        {
          title: meeting.title,
          organizer: meeting.organizer,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
        },
        {
          relatedMeetings: relatedPayload,
          conflicts,
        }
      )
    } catch (llmError) {
      console.warn('[meeting preparation] Falling back to heuristic agenda', llmError)
      preparedAgenda = buildFallbackAgenda({
        decisions: flattenedDecisions,
        openTodoTitles: flattenedOpenTodoTitles,
        hasConflicts: conflicts.length > 0,
      })
    }

    const response: MeetingPreparationResponse = {
      upcomingMeeting: {
        id: meeting.id,
        title: meeting.title,
        organizer: meeting.organizer,
        startTime: meeting.startTime.toISOString(),
        endTime: meeting.endTime.toISOString(),
      },
      relatedMeetings: relatedPayload,
      preparedAgenda,
      knowledgeBaseItems: [],
      conflicts,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to generate meeting preparation:', error)
    return NextResponse.json({ error: 'Failed to generate meeting preparation' }, { status: 500 })
  }
}
