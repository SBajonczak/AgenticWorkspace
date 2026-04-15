import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/authz'
import { auth } from '@/lib/auth'
import { ProjectRepository } from '@/db/repositories/projectRepository'
import { ProjectSourceLinkRepository, KnowledgeSourceType } from '@/db/repositories/projectSourceLinkRepository'

const projectRepo = new ProjectRepository()
const sourceRepo = new ProjectSourceLinkRepository()

function getTenantId(session: any): string | undefined {
  return (session?.user as any)?.tenantId ?? undefined
}

async function resolveProject(id: string, tenantId: string) {
  const p = await projectRepo.findById(id)
  if (!p || (p.tenantId && p.tenantId !== tenantId)) return null
  return p
}

/** GET /api/projects/[id]/sources */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth()
  if (error) return error

  const fullSession = await auth()
  const tenantId = getTenantId(fullSession) as string | undefined
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const project = await resolveProject(params.id, tenantId)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sources = await sourceRepo.findByProject(params.id)
  return NextResponse.json({ sources })
}

const CreateSourceSchema = z.object({
  type: z.enum(['confluence', 'jira', 'github', 'sharepoint']),
  label: z.string().max(200).optional().nullable(),
  identifier: z.string().min(1).max(500),
  config: z.record(z.unknown()).optional().nullable(),
})

/** POST /api/projects/[id]/sources */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth()
  if (error) return error

  const fullSession = await auth()
  const tenantId = getTenantId(fullSession) as string | undefined
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const project = await resolveProject(params.id, tenantId)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CreateSourceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const source = await sourceRepo.create({
    projectId: params.id,
    type: parsed.data.type as KnowledgeSourceType,
    label: parsed.data.label,
    identifier: parsed.data.identifier,
    config: parsed.data.config as Record<string, unknown> | null | undefined,
  })

  return NextResponse.json({ source }, { status: 201 })
}
