/** @jest-environment node */

jest.mock('@/db/prisma', () => ({
  prisma: {
    account: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import { prisma } from '@/db/prisma'
import { UserTokenService, ReauthRequiredError } from '@/graph/userTokenService'

const mockPrisma = prisma as any

describe('UserTokenService', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      AZURE_TENANT_ID: 'tenant-id',
      AZURE_CLIENT_ID: 'client-id',
      AZURE_CLIENT_SECRET: 'client-secret',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns cached access token when not expired', async () => {
    mockPrisma.account.findFirst.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-1',
      provider: 'microsoft-entra-id',
      access_token: 'cached-token',
      refresh_token: 'refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    })

    const service = new UserTokenService({
      setTokenState: jest.fn().mockResolvedValue({}),
    } as any)

    const token = await service.getValidAccessTokenForUser('user-1')
    expect(token).toBe('cached-token')
    expect(mockPrisma.account.update).not.toHaveBeenCalled()
  })

  it('refreshes token and persists account values', async () => {
    mockPrisma.account.findFirst.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-1',
      provider: 'microsoft-entra-id',
      access_token: 'expired-token',
      refresh_token: 'refresh-token',
      expires_at: Math.floor(Date.now() / 1000) - 60,
      token_type: 'Bearer',
      scope: 'offline_access',
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'fresh-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'offline_access User.Read',
      }),
    } as any)

    const service = new UserTokenService({
      setTokenState: jest.fn().mockResolvedValue({}),
    } as any)

    const token = await service.getValidAccessTokenForUser('user-1')
    expect(token).toBe('fresh-token')
    expect(mockPrisma.account.update).toHaveBeenCalled()
  })

  it('throws reauth error on invalid_grant', async () => {
    mockPrisma.account.findFirst.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-1',
      provider: 'microsoft-entra-id',
      access_token: null,
      refresh_token: 'refresh-token',
      expires_at: null,
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({
        error: 'invalid_grant',
        error_description: 'AADSTS700082: The refresh token has expired.',
      }),
    } as any)

    const service = new UserTokenService({
      setTokenState: jest.fn().mockResolvedValue({}),
    } as any)

    await expect(service.getValidAccessTokenForUser('user-1')).rejects.toBeInstanceOf(ReauthRequiredError)
  })
})
