/** @jest-environment node */

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))
jest.mock('@/db/repositories/userSyncStateRepository', () => ({
  UserSyncStateRepository: jest.fn(),
}))
jest.mock('@/db/repositories/meetingRepository', () => ({
  MeetingRepository: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/db/prisma'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { GET } from '@/app/api/dashboard/summary/route'

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as any
const MockSyncRepo = UserSyncStateRepository as jest.MockedClass<typeof UserSyncStateRepository>
const MockMeetingRepo = MeetingRepository as jest.MockedClass<typeof MeetingRepository>

describe('GET /api/dashboard/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockAuth as any).mockResolvedValue({
      user: { id: 'user-1', email: 'alice@example.com', tenantId: 'tenant-1' },
    })
    mockPrisma.user.findUnique.mockResolvedValue({ tenantId: 'tenant-1' })

    MockSyncRepo.mockImplementation(
      () =>
        ({
          getByUserId: jest.fn().mockResolvedValue({ summaryWindowDays: 7 }),
        }) as any
    )

    MockMeetingRepo.mockImplementation(
      () =>
        ({
          findProcessedInWindow: jest.fn().mockResolvedValue([
            {
              id: 'm-1',
              title: 'Daily Sync',
              startTime: new Date('2026-04-24T09:00:00.000Z'),
              summary: 'Reviewed release readiness. Agreed on final QA ownership. Next steps were captured.',
              todos: [
                { id: 't1', assigneeUserId: 'user-1' },
                { id: 't2', assigneeUserId: 'user-2' },
              ],
            },
          ]),
        }) as any
    )
  })

  it('returns a user-scoped summary payload', async () => {
    const res = await GET()
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.windowDays).toBe(7)
    expect(payload.meetingsConductedCount).toBe(1)
    expect(payload.assignedTaskCount).toBe(1)
    expect(payload.meetings[0].assignedTaskCount).toBe(1)
    expect(payload.meetings[0].summary).toBe('Reviewed release readiness. Agreed on final QA ownership.')
  })

  it('returns 401 without session', async () => {
    ;(mockAuth as any).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('clamps summary window when persisted value is out of range', async () => {
    MockSyncRepo.mockImplementation(
      () =>
        ({
          getByUserId: jest.fn().mockResolvedValue({ summaryWindowDays: 999 }),
        }) as any
    )

    const res = await GET()
    expect(res.status).toBe(200)
    const payload = await res.json()

    expect(payload.windowDays).toBe(90)
  })
})
