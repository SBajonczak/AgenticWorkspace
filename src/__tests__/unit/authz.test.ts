/** @jest-environment node */

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/db/prisma', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
    user: {
      updateMany: jest.fn(),
    },
    meeting: {
      findUnique: jest.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { requireAuth, requireProjectAdmin } from '@/lib/authz'

describe('authz tenant hydration', () => {
  const mockAuth = auth as jest.MockedFunction<typeof auth>
  const mockPrisma = prisma as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('hydrates tenantId from azureTid for fresh sessions', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        azureTid: 'azure-tenant-1',
      },
    } as any)
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' })
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })

    const result = await requireAuth()

    expect(result.error).toBeNull()
    expect(result.session).not.toBeNull()
    expect(result.session?.user.tenantId).toBe('tenant-1')
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { azureTenantId: 'azure-tenant-1' },
      select: { id: true },
    })
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', tenantId: null },
      data: { tenantId: 'tenant-1' },
    })
  })

  it('allows project admin checks after tenant hydration', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        azureTid: 'azure-tenant-1',
        appRoles: ['projectadmin'],
      },
    } as any)
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' })
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })

    const result = await requireProjectAdmin()

    expect(result.error).toBeNull()
    expect(result.session?.user.tenantId).toBe('tenant-1')
  })
})