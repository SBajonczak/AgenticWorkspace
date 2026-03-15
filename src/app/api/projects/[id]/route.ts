import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/authz'
import { auth } from '@/lib/auth'
import { ProjectRepository } from '@/db/repositories/projectRepository'

const repo = new ProjectRepository()

function getTenantId(session: any): string | undefined {
  return (session?.user as any)?.tenantId ?? undefined
}

async function resolveProject(id: string, tenantId?: string) {
  const project = await repo.findById(id)
  if (!project) return null
  // Enforce tenant isolation
  if (tenantId) {
    if (project.tenantId && project.tenantId !== tenantId) return null
    return project
  }

  if (project.tenantId) return null
  return project
}

/** GET /api/projects/[id] */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth()
  if (error) return error

  const fullSession = await auth()
  const tenantId = getTenantId(fullSession) as string | undefined

  const project = await resolveProject(params.id, tenantId)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ project })
}

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
  owner: z.string().max(200).optional().nullable(),
  archived: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  aliases: z.array(z.string().min(1).max(200)).optional(),
})

/** PUT /api/projects/[id] */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth()
  if (error) return error

  const fullSession = await auth()
  const tenantId = getTenantId(fullSession) as string | undefined

  const existing = await resolveProject(params.id, tenantId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth()
  if (error) return error

  const fullSession = await auth()
  const tenantId = getTenantId(fullSession) as string | undefined

  const existing = await resolveProject(params.id, tenantId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await repo.delete(params.id)
  return NextResponse.json({ ok: true })
}
