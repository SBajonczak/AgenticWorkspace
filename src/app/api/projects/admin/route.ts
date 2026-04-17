import { NextResponse } from 'next/server'
import { requireAuth, isProjectAdmin } from '@/lib/authz'
import { ProjectRepository } from '@/db/repositories/projectRepository'

const repo = new ProjectRepository()

function getTenantId(session: any): string | undefined {
  return (session?.user as any)?.tenantId ?? undefined
}

/** GET /api/projects/admin — list ALL projects for the tenant (projectadmin only) */
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  if (!isProjectAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = getTenantId(session)
  const projects = await repo.findAllByTenant(tenantId)

  return NextResponse.json({ projects })
}
