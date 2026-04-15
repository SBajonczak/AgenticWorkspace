import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authz'
import { auth } from '@/lib/auth'
import { ProjectRepository } from '@/db/repositories/projectRepository'
import { prisma } from '@/db/prisma'

const repo = new ProjectRepository()

type ContextTodo = {
  id: string
  title: string
  assigneeHint: string | null
  status: string
  priority: string
  dueDate: Date | null
  projectId: string | null
}

function getTenantId(session: any): string | undefined {
  return (session?.user as any)?.tenantId ?? undefined
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

/** GET /api/projects/[id]/context — aggregated project data for the detail page */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth()
  if (error) return error

  const fullSession = await auth()
  const tenantId = getTenantId(fullSession)

  // Tenant-isolate project lookup
  const project = await repo.findById(params.id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.tenantId && project.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Load project statuses with their associated meeting data
  const statuses = await prisma.projectStatus.findMany({
    where: { projectId: params.id },
    include: {
      meeting: {
        include: {
          todos: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Build per-meeting summary entries
  const meetings = statuses.map((statusRow) => {
    const m = statusRow.meeting
    const decisions = parseDecisions(m.decisions)
    const meetingTodos = m.todos as unknown as ContextTodo[]
    const openTodos = meetingTodos
      .filter((t) => t.status !== 'done' && t.projectId === params.id)
      .map((t) => ({
        id: t.id,
        title: t.title,
        assigneeHint: t.assigneeHint,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      }))

    return {
      id: m.id,
      meetingId: m.meetingId,
      title: m.title,
      organizer: m.organizer,
      startTime: m.startTime.toISOString(),
      endTime: m.endTime.toISOString(),
      processedAt: m.processedAt ? m.processedAt.toISOString() : null,
      projectStatus: {
        status: statusRow.status,
        summary: statusRow.summary,
      },
      decisions,
      openTodos,
    }
  })

  // Aggregate stats
  const allTodos = statuses.flatMap((s) =>
    (s.meeting.todos as unknown as ContextTodo[]).filter(
      (todo) => todo.projectId === params.id
    )
  )
  const stats = {
    totalMeetings: meetings.length,
    totalTodos: allTodos.length,
    openTodos: allTodos.filter((t) => t.status !== 'done').length,
    totalDecisions: meetings.reduce((acc, m) => acc + m.decisions.length, 0),
  }

  // Build knowledge base sections (flatten, de-dup, limit to 20 each)
  const recentDecisions = meetings
    .flatMap((m) =>
      m.decisions.map((text) => ({
        text,
        meetingId: m.meetingId,
        meetingTitle: m.title,
        date: m.startTime,
      }))
    )
    .slice(0, 20)

  const openTodosKb = meetings
    .flatMap((m) =>
      m.openTodos.map((t) => ({
        ...t,
        meetingId: m.meetingId,
        meetingTitle: m.title,
      }))
    )
    .slice(0, 20)

  const recentStatuses = meetings
    .map((m) => ({
      status: m.projectStatus.status,
      summary: m.projectStatus.summary,
      meetingId: m.meetingId,
      meetingTitle: m.title,
      date: m.startTime,
    }))
    .slice(0, 10)

  return NextResponse.json({
    project,
    meetings,
    stats,
    knowledgeBase: {
      recentDecisions,
      openTodos: openTodosKb,
      recentStatuses,
    },
  })
}
