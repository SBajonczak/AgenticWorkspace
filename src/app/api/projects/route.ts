import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/authz'
import { auth } from '@/lib/auth'
import { ProjectRepository } from '@/db/repositories/projectRepository'

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

/** GET /api/projects — list all non-archived projects for the current tenant */
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = getTenantId(session)
  const identity = getIdentity(session)
  const projects = await repo.findAccessibleByIdentity(tenantId, identity.tid, identity.oid)
  return NextResponse.json({ projects })
}

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
  aliases: z.array(z.string().min(1).max(200)).optional(),
})

/** POST /api/projects — create a new project */
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const fullSession = await auth()
  const tenantId = getTenantId(fullSession) as string | undefined
  const identity = getIdentity(session)
  const ownerName = session.user.name ?? session.user.email ?? null

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CreateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { aliases, ...data } = parsed.data
  const project = await repo.create({
    ...data,
    tenantId: tenantId ?? null,
    owner: ownerName,
    ownerName,
    ownerOid: identity.oid ?? null,
    ownerTid: identity.tid ?? null,
  })

  if (aliases && aliases.length > 0) {
    await repo.setAliases(project.id, aliases)
    return NextResponse.json({ project: await repo.findById(project.id) }, { status: 201 })
  }

  return NextResponse.json({ project }, { status: 201 })
}
