/** @jest-environment node */

import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/db/repositories/userSyncStateRepository', () => ({
  UserSyncStateRepository: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { GET, PUT } from '@/app/api/user/settings/route'

const mockAuth = auth as jest.MockedFunction<typeof auth>
const MockRepo = UserSyncStateRepository as jest.MockedClass<typeof UserSyncStateRepository>

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/user/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/user/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockAuth as any).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('returns defaults when sync state does not exist', async () => {
    MockRepo.mockImplementation(
      () =>
        ({
          getByUserId: jest.fn().mockResolvedValue(null),
        }) as any
    )

    const res = await GET()
    expect(res.status).toBe(200)
    const payload = await res.json()

    expect(payload.meetingLookaheadDays).toBe(14)
    expect(payload.summaryWindowDays).toBe(7)
  })
})

describe('PUT /api/user/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockAuth as any).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('persists both lookahead and summary window', async () => {
    MockRepo.mockImplementation(
      () =>
        ({
          upsert: jest.fn().mockResolvedValue({
            meetingLookaheadDays: 21,
            summaryWindowDays: 14,
          }),
        }) as any
    )

    const res = await PUT(makeRequest({ meetingLookaheadDays: 21, summaryWindowDays: 14 }))
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.meetingLookaheadDays).toBe(21)
    expect(payload.summaryWindowDays).toBe(14)
  })

  it('rejects invalid summary window', async () => {
    const res = await PUT(makeRequest({ meetingLookaheadDays: 14, summaryWindowDays: 0 }))
    expect(res.status).toBe(422)
  })
})
