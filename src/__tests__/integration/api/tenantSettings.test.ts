/** @jest-environment node */

import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/db/prisma', () => ({
  prisma: {
    tenant: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}))
jest.mock('@/tickets/factory', () => ({
  createTicketProvider: jest.fn(() => ({
    type: 'jira',
    testConnection: jest.fn().mockResolvedValue(true),
    createTicket: jest.fn(),
    findAssignee: jest.fn(),
  })),
  createTicketProviderFromEnv: jest.fn(() => ({ type: 'none' })),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { GET, PUT } from '@/app/api/tenants/settings/route'

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as any

const mockSession = { user: { id: 'user-1', email: 'alice@example.com', tenantId: 'tenant-1' } }
const mockTenant = {
  id: 'tenant-1',
  azureTenantId: 'azure-tenant-id',
  name: 'Acme Corp',
  ticketProvider: 'jira',
  ticketConfig: JSON.stringify({
    type: 'jira',
    host: 'https://acme.atlassian.net',
    email: 'bot@acme.com',
    apiToken: 'secret',
    projectKey: 'ACME',
  }),
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/tenants/settings', {
    method: body ? 'PUT' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/tenants/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockAuth as any).mockResolvedValue(mockSession)
    mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant)
  })

  it('returns 401 when not authenticated', async () => {
    ;(mockAuth as any).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns tenant settings with redacted secrets', async () => {
    const res = await GET()
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ticketProvider).toBe('jira')
    expect(data.ticketConfig.host).toBe('https://acme.atlassian.net')
    expect(data.ticketConfig.apiToken).toBe('***')
    expect(data.name).toBe('Acme Corp')
  })

  it('returns 400 when user has no tenant', async () => {
    ;(mockAuth as any).mockResolvedValue({ user: { id: 'u1', email: 'x@x.com' } })
    const res = await GET()
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/tenants/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockAuth as any).mockResolvedValue(mockSession)
    mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant)
    mockPrisma.tenant.update.mockResolvedValue({ ...mockTenant, ticketProvider: 'jira' })
  })

  it('returns 401 when not authenticated', async () => {
    ;(mockAuth as any).mockResolvedValue(null)
    const res = await PUT(makeRequest({ ticketProvider: 'none' }))
    expect(res.status).toBe(401)
  })

  it('updates ticket provider and returns ok', async () => {
    const res = await PUT(makeRequest({
      ticketProvider: 'jira',
      ticketConfig: { host: 'https://acme.atlassian.net', email: 'bot@acme.com', apiToken: 'new-token', projectKey: 'ACME' },
    }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.ticketProvider).toBe('jira')
  })

  it('returns 422 on invalid ticketProvider value', async () => {
    const res = await PUT(makeRequest({ ticketProvider: 'slack' }))
    expect(res.status).toBe(422)
  })

  it('accepts none provider without calling testConnection', async () => {
    const { createTicketProvider } = require('@/tickets/factory')
    createTicketProvider.mockClear()
    const res = await PUT(makeRequest({ ticketProvider: 'none' }))
    expect(res.status).toBe(200)
    expect(createTicketProvider).not.toHaveBeenCalled()
  })
})
