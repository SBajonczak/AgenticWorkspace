/** @jest-environment node */

jest.mock('@/lib/authz', () => ({
  requireAuth: jest.fn(),
}))
jest.mock('@/worker/scheduler', () => ({
  runAgentCycleForUser: jest.fn(),
}))
jest.mock('@/db/repositories/userSyncStateRepository', () => ({
  UserSyncStateRepository: jest.fn(),
}))

import { requireAuth } from '@/lib/authz'
import { runAgentCycleForUser } from '@/worker/scheduler'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { POST } from '@/app/api/agent/run/route'

describe('POST /api/agent/run', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    ;(requireAuth as jest.Mock).mockResolvedValue({
      session: { user: { id: 'user-1', email: 'alice@example.com' } },
      error: null,
    })

    ;(UserSyncStateRepository as jest.Mock).mockImplementation(() => ({
      getByUserId: jest.fn().mockResolvedValue({
        userId: 'user-1',
        hasRefreshToken: true,
        consentRequired: false,
      }),
    }))

    ;(runAgentCycleForUser as jest.Mock).mockResolvedValue(undefined)
  })

  it('starts immediate processing for authenticated user', async () => {
    const req = new Request('http://localhost/api/agent/run', {
      method: 'POST',
      body: JSON.stringify({ dryRun: false }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(runAgentCycleForUser).toHaveBeenCalledWith('user-1')
  })

  it('returns reauth required when consent/token state is invalid', async () => {
    ;(UserSyncStateRepository as jest.Mock).mockImplementation(() => ({
      getByUserId: jest.fn().mockResolvedValue({
        userId: 'user-1',
        hasRefreshToken: false,
        consentRequired: true,
      }),
    }))

    const req = new Request('http://localhost/api/agent/run', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(409)
    expect(runAgentCycleForUser).not.toHaveBeenCalled()
  })
})
