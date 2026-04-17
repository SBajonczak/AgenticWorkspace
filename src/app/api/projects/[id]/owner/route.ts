import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, isProjectAdmin } from '@/lib/authz'
import { ProjectRepository } from '@/db/repositories/projectRepository'

const repo = new ProjectRepository()

const UpdateOwnerSchema = z.object({
  ownerOid: z.string().min(1),
  ownerTid: z.string().min(1),
  ownerName: z.string().min(1),
})

/** PUT /api/projects/[id]/owner — change project owner (projectadmin only) */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  if (!isProjectAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateOwnerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const project = await repo.findById(params.id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const tenantId = (session.user as any)?.tenantId
  if (tenantId && project.tenantId && project.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await repo.updateOwner(params.id, parsed.data)

  return NextResponse.json({ project: updated })
}
