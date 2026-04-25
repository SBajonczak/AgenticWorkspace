import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/authz'
import { ProjectRepository } from '@/db/repositories/projectRepository'
import { ProjectSourceLinkRepository } from '@/db/repositories/projectSourceLinkRepository'

const projectRepo = new ProjectRepository()
const sourceRepo = new ProjectSourceLinkRepository()

function getTenantId(session: any): string | undefined {
  return (session?.user as any)?.tenantId ?? undefined
}

async function resolveSource(projectId: string, sourceId: string, tenantId: string) {
  const project = await projectRepo.findById(projectId)
  if (!project || (project.tenantId && project.tenantId !== tenantId)) return null
  const source = await sourceRepo.findById(sourceId)
  if (!source || source.projectId !== projectId) return null
  return source
}

const UpdateSourceSchema = z.object({
  label: z.string().max(200).optional().nullable(),
  identifier: z.string().min(1).max(500).optional(),
  config: z.record(z.unknown()).optional().nullable(),
})

/** PUT /api/projects/[id]/sources/[sourceId] */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; sourceId: string } }
) {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const source = await resolveSource(params.id, params.sourceId, tenantId)
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = UpdateSourceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const updated = await sourceRepo.update(params.sourceId, {
    label: parsed.data.label,
    ...(parsed.data.identifier !== undefined ? { identifier: parsed.data.identifier } : {}),
    ...(parsed.data.config !== undefined
      ? { config: parsed.data.config as Record<string, unknown> | null }
      : {}),
  })

  return NextResponse.json({ source: updated })
}

/** DELETE /api/projects/[id]/sources/[sourceId] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; sourceId: string } }
) {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const source = await resolveSource(params.id, params.sourceId, tenantId)
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await sourceRepo.delete(params.sourceId)
  return NextResponse.json({ ok: true })
}
