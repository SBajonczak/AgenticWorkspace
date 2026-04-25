import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/authz'
import { ProjectRepository } from '@/db/repositories/projectRepository'
import { prisma } from '@/db/prisma'

const repo = new ProjectRepository()

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

async function resolveProject(id: string, tenantId?: string, identity?: { oid?: string; tid?: string }) {
  const project = await repo.findById(id)
  if (!project) return null
  // Enforce tenant isolation
  if (tenantId) {
    if (project.tenantId && project.tenantId !== tenantId) return null
    const hasAccess = await repo.canUserAccessProject(id, identity?.tid, identity?.oid)
    return hasAccess ? project : null
  }

  if (project.tenantId) return null
  const hasAccess = await repo.canUserAccessProject(id, identity?.tid, identity?.oid)
  return hasAccess ? project : null
}

/** GET /api/projects/[id] */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = session.user.tenantId
  const identity = getIdentity(session)

  const project = await resolveProject(params.id, tenantId, identity)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ project })
}

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
  archived: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  aliases: z.array(z.string().min(1).max(200)).optional(),
})

const DeleteProjectSchema = z.object({
  reassignToProjectId: z.string().min(1),
})

/** PUT /api/projects/[id] */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = session.user.tenantId
  const identity = getIdentity(session)

  const existing = await resolveProject(params.id, tenantId, identity)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = await repo.isProjectOwner(params.id, identity.tid, identity.oid)
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden: only owner can update project' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = UpdateProjectSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { aliases, ...updateData } = parsed.data
  const updated = await repo.update(params.id, updateData)

  if (aliases !== undefined) {
    await repo.setAliases(params.id, aliases)
    return NextResponse.json({ project: await repo.findById(params.id) })
  }

  return NextResponse.json({ project: updated })
}

/** DELETE /api/projects/[id] */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = session.user.tenantId
  const identity = getIdentity(session)

  const existing = await resolveProject(params.id, tenantId, identity)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = await repo.isProjectOwner(params.id, identity.tid, identity.oid)
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden: only owner can delete project' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = DeleteProjectSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { reassignToProjectId } = parsed.data

  if (reassignToProjectId === params.id) {
    return NextResponse.json({ error: 'Cannot reassign todos to the same project' }, { status: 400 })
  }

  const target = await resolveProject(reassignToProjectId, tenantId, identity)
  if (!target) return NextResponse.json({ error: 'Reassignment target not found' }, { status: 404 })

  if (target.archived || target.status !== 'active') {
    return NextResponse.json({ error: 'Reassignment target must be active' }, { status: 400 })
  }

  if (!target.confirmed) {
    return NextResponse.json({ error: 'Reassignment target must be confirmed' }, { status: 400 })
  }

  const reassignedCount = await prisma.$transaction(async (tx) => {
    const reassigned = await tx.todo.updateMany({
      where: { projectId: params.id },
      data: { projectId: reassignToProjectId },
    })

    await tx.project.delete({ where: { id: params.id } })

    return reassigned.count
  })

  return NextResponse.json({
    ok: true,
    deletedProjectId: params.id,
    targetProjectId: reassignToProjectId,
    reassignedCount,
  })
}
