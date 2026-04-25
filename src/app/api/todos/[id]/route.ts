import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, requireMeetingParticipant, isProjectAdmin } from '@/lib/authz'
import { TodoRepository } from '@/db/repositories/todoRepository'
import { ProjectRepository } from '@/db/repositories/projectRepository'

const PatchTodoSchema = z.object({
  projectId: z.string().min(1).nullable().optional(),
  assigneeUserId: z.string().min(1).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
})

function getTenantId(session: any): string | undefined {
  return (session?.user as any)?.tenantId ?? undefined
}

function getIdentity(session: any): { oid?: string; tid?: string } {
  const user = (session?.user as any) ?? {}
  return {
    oid: user.aadObjectId ?? undefined,
    tid: user.azureTid ?? undefined,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const todoRepo = new TodoRepository()
  const projectRepo = new ProjectRepository()

  const { session, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchTodoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const todo = await todoRepo.findById(params.id)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  if (!isProjectAdmin(session)) {
    if (!todo.meetingId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const participantCheck = await requireMeetingParticipant(todo.meetingId)
    if (participantCheck.error) {
      return participantCheck.error
    }
  }

  const tenantId = getTenantId(session)
  const identity = getIdentity(session)
  const { projectId, assigneeUserId, status } = parsed.data

  if (projectId !== undefined && projectId !== null) {
    const project = await projectRepo.findById(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.archived || project.status !== 'active') {
      return NextResponse.json({ error: 'Project must be active' }, { status: 400 })
    }

    if (!project.confirmed) {
      return NextResponse.json({ error: 'Project must be confirmed' }, { status: 400 })
    }

    if (tenantId) {
      if (project.tenantId && project.tenantId !== tenantId) {
        return NextResponse.json({ error: 'Forbidden project scope' }, { status: 403 })
      }
    } else if (project.tenantId) {
      return NextResponse.json({ error: 'Forbidden project scope' }, { status: 403 })
    }

    const hasAccess = await projectRepo.canUserAccessProject(project.id, identity.tid, identity.oid)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden project access' }, { status: 403 })
    }
  }

  if (projectId !== undefined) {
    await todoRepo.assignProject(todo.id, projectId)
  }

  if (assigneeUserId !== undefined) {
    await todoRepo.update(todo.id, { assigneeUserId })
  }

  if (status !== undefined) {
    await todoRepo.update(todo.id, { status })
  }

  const updated = await todoRepo.findById(todo.id)

  return NextResponse.json({
    todo: {
      id: updated!.id,
      projectId: updated!.projectId,
      assigneeUserId: (updated as any).assigneeUserId ?? null,
      status: updated!.status,
    },
  })
}
