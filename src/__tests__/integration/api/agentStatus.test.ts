/** @jest-environment node */

jest.mock('@/lib/authz', () => ({
  requireAuth: jest.fn(),
}))
jest.mock('@/db/repositories/userSyncStateRepository', () => ({
  UserSyncStateRepository: jest.fn(),
}))

import { requireAuth } from '@/lib/authz'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { GET } from '@/app/api/agent/status/route'

describe('GET /api/agent/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireAuth as jest.Mock).mockResolvedValue({
      session: { user: { id: 'user-1', email: 'alice@example.com' } },
      error: null,
    })
  })

  it('returns default status when no sync state exists', async () => {
    ;(UserSyncStateRepository as jest.Mock).mockImplementation(() => ({
      getByUserId: jest.fn().mockResolvedValue(null),
    }))

    const res = await GET()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.isProcessing).toBe(false)
    expect(data.nextRunAt).toBeNull()
    expect(data.consentRequired).toBe(false)
  })

  it('returns persisted sync state values', async () => {
    ;(UserSyncStateRepository as jest.Mock).mockImplementation(() => ({
      getByUserId: jest.fn().mockResolvedValue({
        isProcessing: true,
        nextRunAt: new Date('2026-03-14T12:00:00Z'),
        lastRunAt: new Date('2026-03-14T11:30:00Z'),
        lastSuccessAt: new Date('2026-03-14T11:30:00Z'),
        consentRequired: false,
        hasRefreshToken: true,
        lastError: null,
      }),
    }))

    const res = await GET()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.isProcessing).toBe(true)
    expect(data.nextRunAt).toBe('2026-03-14T12:00:00.000Z')
  })
})
