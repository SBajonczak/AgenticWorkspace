import { NextResponse } from 'next/server'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { ProjectRepository } from '@/db/repositories/projectRepository'
import { requireMeetingParticipant } from '@/lib/authz'
import { createLLMClient } from '@/ai/llmClient'
import { prisma } from '@/db/prisma'
import {
  MeetingPreparationAgendaItem,
  MeetingPreparationResponse,
} from '@/types/meetings'
import { searchProjectSources } from '@/lib/projectSourceSearch'
import {
  dedupeDecisionItems,
  getDecisionTopics,
  parseDecisionItems,
} from '@/lib/meetingDecisions'

type CadenceType = 'daily' | 'jourfix' | 'recurring' | 'other'

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

function parseDecisions(value: string | null): string[] {
  return getDecisionTopics(parseDecisionItems(value))
}

function clampLookaheadDays(value: unknown): number {
  const fallback = 14
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.trunc(parsed)
  return Math.max(1, Math.min(31, normalized))
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

function detectCadence(title: string): MeetingPreparationResponse['cadence'] {
  const normalized = title.toLowerCase()
  if (/(^|\s)(daily|standup|stand-up)(\s|$)/i.test(normalized)) {
    return { isRecurring: true, type: 'daily', label: 'Daily' }
  }
  if (/(jour\s?fix|jourfix|weekly\s+sync|wochen(?:sync|runde))/i.test(normalized)) {
    return { isRecurring: true, type: 'jourfix', label: 'Jourfix' }
  }
  if (/(weekly|biweekly|monthly|sync|review|retro|planning)/i.test(normalized)) {
    return { isRecurring: true, type: 'recurring', label: 'Recurring' }
  }
  return { isRecurring: false, type: 'other', label: 'One-off' }
}

function normalizeTopic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function analyzeOpenTopics(
  relatedMeetings: MeetingPreparationResponse['relatedMeetings'],
  upcomingStartTime: Date
): {
  carryOverTopics: MeetingPreparationResponse['carryOverTopics']
  longRunningTasks: MeetingPreparationResponse['longRunningTasks']
} {
  const topicMap = new Map<string, {
    title: string
    occurrences: number
    firstSeenAt: string
    lastSeenAt: string
  }>()

  for (const relatedMeeting of relatedMeetings) {
    for (const todo of relatedMeeting.openTodos) {
      const key = normalizeTopic(todo.title)
      if (!key) continue

      const existing = topicMap.get(key)
      if (!existing) {
        topicMap.set(key, {
          title: todo.title,
          occurrences: 1,
          firstSeenAt: relatedMeeting.startTime,
          lastSeenAt: relatedMeeting.startTime,
        })
        continue
      }

      const firstSeenAt = new Date(existing.firstSeenAt) <= new Date(relatedMeeting.startTime)
        ? existing.firstSeenAt
        : relatedMeeting.startTime
      const lastSeenAt = new Date(existing.lastSeenAt) >= new Date(relatedMeeting.startTime)
        ? existing.lastSeenAt
        : relatedMeeting.startTime

      topicMap.set(key, {
        ...existing,
        occurrences: existing.occurrences + 1,
        firstSeenAt,
        lastSeenAt,
      })
    }
  }

  const sortedTopics = [...topicMap.values()]
    .sort((a, b) => b.occurrences - a.occurrences)

  const carryOverTopics = sortedTopics
    .filter((topic) => topic.occurrences >= 2)
    .slice(0, 8)
    .map((topic) => ({
      title: topic.title,
      occurrences: topic.occurrences,
      lastSeenAt: topic.lastSeenAt,
    }))

  const longRunningTasks = sortedTopics
    .map((topic) => {
      const ageDays = Math.max(
        0,
        Math.floor((upcomingStartTime.getTime() - new Date(topic.firstSeenAt).getTime()) / (24 * 60 * 60 * 1000))
      )
      return {
        title: topic.title,
        occurrences: topic.occurrences,
        ageDays,
        firstSeenAt: topic.firstSeenAt,
      }
    })
    .filter((topic) => topic.occurrences >= 2 || topic.ageDays >= 14)
    .sort((a, b) => {
      if (b.ageDays !== a.ageDays) return b.ageDays - a.ageDays
      return b.occurrences - a.occurrences
    })
    .slice(0, 8)

  return {
    carryOverTopics,
    longRunningTasks,
  }
}

function buildPrepStatus(input: {
  conflicts: MeetingPreparationResponse['conflicts']
  carryOverTopics: MeetingPreparationResponse['carryOverTopics']
  longRunningTasks: MeetingPreparationResponse['longRunningTasks']
  cadenceType: CadenceType
  preparedAgendaCount: number
}): MeetingPreparationResponse['prepStatus'] {
  const reasons: string[] = []

  if (input.conflicts.length > 0) {
    reasons.push(`${input.conflicts.length} scheduling conflict${input.conflicts.length > 1 ? 's' : ''}`)
  }
  if (input.longRunningTasks.length > 0) {
    reasons.push(`${input.longRunningTasks.length} long-running topic${input.longRunningTasks.length > 1 ? 's' : ''}`)
  }
  if (input.cadenceType === 'daily' || input.cadenceType === 'jourfix') {
    reasons.push('recurring status format detected')
  }

  if (input.preparedAgendaCount === 0) {
    reasons.push('no prepared agenda items yet')
    return { level: 'in_progress', reasons }
  }

  if (input.conflicts.length > 0 || input.longRunningTasks.length > 0) {
    return { level: 'attention', reasons }
  }

  if (reasons.length === 0) {
    reasons.push('agenda and context prepared')
  }

  return { level: 'ready', reasons }
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

    const syncState = await prisma.userSyncState.findUnique({
      where: { userId: session.user.id },
    })
    const lookaheadDays = clampLookaheadDays((syncState as any)?.meetingLookaheadDays)
    const lookaheadUntil = new Date(Date.now() + lookaheadDays * 24 * 60 * 60 * 1000)

    const upcomingMeetings = await meetingRepo.findUpcoming(100, new Date(), tenantId, userEmail)
    const conflicts = upcomingMeetings
      .filter(
        (candidate) =>
          candidate.id !== meeting.id &&
          candidate.startTime <= lookaheadUntil &&
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

    const flattenedDecisions = getDecisionTopics(
      dedupeDecisionItems(relatedPayload.flatMap((meetingItem) => meetingItem.decisions))
    )
    const flattenedOpenTodoTitles = relatedPayload.flatMap((meetingItem) =>
      meetingItem.openTodos.map((todo) => todo.title)
    )
    const cadence = detectCadence(meeting.title)
    const topicAnalysis = analyzeOpenTopics(relatedPayload, meeting.startTime)

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

    // Build knowledgeBase items from projects mentioned in related meetings
    const projectRepo = new ProjectRepository()
    const projectNames = [
      ...new Set(relatedPayload.flatMap((m) => m.projectStatuses.map((ps) => ps.projectName))),
    ]
    const knowledgeBaseItems: MeetingPreparationResponse['knowledgeBaseItems'] = []
    const projectSourceResults: MeetingPreparationResponse['projectSourceResults'] = []

    for (const projectName of projectNames.slice(0, 5)) {
      try {
        const proj = await projectRepo.findByNameOrAlias(projectName, tenantId)
        if (!proj) continue

        const recentStatuses = await prisma.projectStatus.findMany({
          where: { projectId: proj.id },
          include: { meeting: { include: { todos: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })

        const decisions = getDecisionTopics(
          dedupeDecisionItems(
            recentStatuses.flatMap((statusItem) => parseDecisionItems(statusItem.meeting.decisions))
          )
        )

        const openTodos = recentStatuses
          .flatMap((s) => s.meeting.todos.filter((t) => t.status !== 'done'))
          .map((t) => ({
            id: t.id,
            title: t.title,
            assigneeHint: t.assigneeHint,
            priority: t.priority,
          }))

        knowledgeBaseItems.push({
          title: proj.name,
          excerpt: `${openTodos.length} open item${openTodos.length !== 1 ? 's' : ''}, ${decisions.length} recent decision${decisions.length !== 1 ? 's' : ''}`,
          decisions: decisions.slice(0, 5),
          openTodos: openTodos.slice(0, 5),
        })

        const sourceResults = await searchProjectSources({
          projectName: proj.name,
          meetingTitle: meeting.title,
          agendaTitles: preparedAgenda.map((item) => item.title),
          sourceLinks: proj.sourceLinks,
        })

        for (const sourceResult of sourceResults) {
          projectSourceResults.push({
            projectName: proj.name,
            sourceType: sourceResult.sourceType,
            sourceLabel: sourceResult.sourceLabel,
            identifier: sourceResult.identifier,
            query: sourceResult.query,
            score: sourceResult.score,
            items: sourceResult.items,
          })
        }
      } catch (err) {
        console.warn('[preparation] Could not load KB for project', projectName, err)
      }
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
      knowledgeBaseItems,
      conflicts,
      cadence,
      carryOverTopics: topicAnalysis.carryOverTopics,
      longRunningTasks: topicAnalysis.longRunningTasks,
      prepStatus: buildPrepStatus({
        conflicts,
        carryOverTopics: topicAnalysis.carryOverTopics,
        longRunningTasks: topicAnalysis.longRunningTasks,
        cadenceType: cadence.type,
        preparedAgendaCount: preparedAgenda.length,
      }),
      projectSourceResults: projectSourceResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to generate meeting preparation:', error)
    return NextResponse.json({ error: 'Failed to generate meeting preparation' }, { status: 500 })
  }
}
