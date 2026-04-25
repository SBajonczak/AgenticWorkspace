/**
 * POST /api/projects/[id]/sources/validate
 *
 * Validates connectivity for a proposed knowledge-source link before saving.
 * This is a lightweight reachability check – it does not attempt to read/index content.
 *
 * Supported types:
 *   confluence  – HTTP HEAD to <baseUrl>/rest/api/space/<spaceKey>
 *   jira        – HTTP HEAD to <host>/rest/api/2/project/<projectKey>
 *   github      – GitHub API GET /repos/<owner>/<repo>
 *   sharepoint  – HTTP HEAD to the provided site URL
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/authz'
import { ProjectRepository } from '@/db/repositories/projectRepository'

const projectRepo = new ProjectRepository()

function getTenantId(session: any): string | undefined {
  return (session?.user as any)?.tenantId ?? undefined
}

const ValidateSchema = z.object({
  type: z.enum(['confluence', 'jira', 'github', 'sharepoint']),
  identifier: z.string().min(1).max(500),
  config: z.record(z.unknown()).optional().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  // Verify project belongs to tenant
  const project = await projectRepo.findById(params.id)
  if (!project || (project.tenantId && project.tenantId !== tenantId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = ValidateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { type, identifier, config } = parsed.data
  const cfg = (config ?? {}) as Record<string, string>

  try {
    let ok = false
    let message = ''

    switch (type) {
      case 'confluence': {
        const baseUrl = cfg.baseUrl?.replace(/\/$/, '')
        if (!baseUrl) {
          return NextResponse.json({ ok: false, message: 'config.baseUrl is required for Confluence' }, { status: 422 })
        }
        const token = cfg.token ?? cfg.apiToken ?? ''
        const email = cfg.email ?? ''
        const headers: Record<string, string> = {}
        if (token && email) {
          headers['Authorization'] = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
        }
        const res = await fetch(`${baseUrl}/rest/api/space/${encodeURIComponent(identifier)}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(8000),
        })
        ok = res.ok || res.status === 401 // 401 means the endpoint exists (auth required)
        message = ok ? 'Confluence space reachable' : `HTTP ${res.status}`
        break
      }

      case 'jira': {
        const host = cfg.host?.replace(/\/$/, '')
        if (!host) {
          return NextResponse.json({ ok: false, message: 'config.host is required for Jira' }, { status: 422 })
        }
        const token = cfg.apiToken ?? cfg.token ?? ''
        const email = cfg.email ?? ''
        const headers: Record<string, string> = {}
        if (token && email) {
          headers['Authorization'] = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
        }
        const res = await fetch(`${host}/rest/api/2/project/${encodeURIComponent(identifier)}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(8000),
        })
        ok = res.ok || res.status === 401
        message = ok ? 'Jira project reachable' : `HTTP ${res.status}`
        break
      }

      case 'github': {
        // identifier format: "owner/repo"
        const [ghOwner, ghRepo] = identifier.split('/')
        if (!ghOwner || !ghRepo) {
          return NextResponse.json({ ok: false, message: 'identifier must be "owner/repo" for GitHub' }, { status: 422 })
        }
        const token = cfg.token ?? ''
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github+json',
        }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch(`https://api.github.com/repos/${ghOwner}/${ghRepo}`, {
          headers,
          signal: AbortSignal.timeout(8000),
        })
        ok = res.ok || res.status === 401
        message = ok ? 'GitHub repo reachable' : `HTTP ${res.status}`
        break
      }

      case 'sharepoint': {
        // identifier is the SharePoint site URL
        const res = await fetch(identifier, {
          method: 'HEAD',
          signal: AbortSignal.timeout(8000),
        })
        ok = res.ok || res.status === 401 || res.status === 403
        message = ok ? 'SharePoint site reachable' : `HTTP ${res.status}`
        break
      }
    }

    return NextResponse.json({ ok, message })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connection error'
    return NextResponse.json({ ok: false, message: msg }, { status: 200 })
  }
}
