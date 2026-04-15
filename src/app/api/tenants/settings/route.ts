import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { TenantRepository } from '@/db/repositories/tenantRepository'
import { createTicketProvider } from '@/tickets/factory'
import { TicketProviderConfig } from '@/tickets/types'
import { z } from 'zod'

const tenantRepo = new TenantRepository()

/** GET /api/tenants/settings — returns current tenant's ticket provider config (sans secrets) */
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = (session.user as any).tenantId as string | undefined
  if (!tenantId) return NextResponse.json({ error: 'No tenant associated with this account' }, { status: 400 })

  const tenant = await tenantRepo.findById(tenantId)
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // Return config with secrets redacted
  let redactedConfig: Record<string, unknown> | null = null
  if (tenant.ticketConfig) {
    try {
      const cfg = JSON.parse(tenant.ticketConfig) as Record<string, unknown>
      redactedConfig = {
        ...cfg,
        ...(cfg.apiToken ? { apiToken: '***' } : {}),
        ...(cfg.personalAccessToken ? { personalAccessToken: '***' } : {}),
        ...(cfg.token ? { token: '***' } : {}),
      }
    } catch {
      redactedConfig = null
    }
  }

  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    ticketProvider: tenant.ticketProvider,
    ticketConfig: redactedConfig,
  })
}

const UpdateSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ticketProvider: z.enum(['jira', 'github', 'azuredevops', 'none']),
  ticketConfig: z.record(z.unknown()).optional(),
})

/** PUT /api/tenants/settings — update ticket provider config */
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = (session.user as any).tenantId as string | undefined
  if (!tenantId) return NextResponse.json({ error: 'No tenant associated with this account' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, ticketProvider, ticketConfig } = parsed.data

  if (name) {
    await tenantRepo.update(tenantId, { name })
  }

  const config = { type: ticketProvider, ...ticketConfig } as TicketProviderConfig

  // Validate connectivity before saving
  if (ticketProvider !== 'none') {
    const provider = createTicketProvider(config)
    const ok = await provider.testConnection()
    if (!ok) {
      return NextResponse.json(
        { error: `Could not connect to ${ticketProvider}. Check your credentials.` },
        { status: 422 }
      )
    }
  }

  await tenantRepo.updateTicketProvider(tenantId, ticketProvider, config)

  return NextResponse.json({ ok: true, ticketProvider })
}
