/** @jest-environment node */

jest.mock('@/lib/authz', () => ({
  requireMeetingParticipant: jest.fn(),
}))
jest.mock('@/db/repositories/meetingRepository')
jest.mock('@/db/repositories/userSyncStateRepository')

import { NextResponse } from 'next/server'
import { requireMeetingParticipant } from '@/lib/authz'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { GET } from '@/app/api/meetings/[id]/optimization-suggestions/route'

const mockRequireMeetingParticipant = requireMeetingParticipant as jest.MockedFunction<typeof requireMeetingParticipant>
const MockMeetingRepo = MeetingRepository as jest.MockedClass<typeof MeetingRepository>
const MockSyncRepo = UserSyncStateRepository as jest.MockedClass<typeof UserSyncStateRepository>

describe('GET /api/meetings/[id]/optimization-suggestions', () => {
  const meetingRepo = {
    findById: jest.fn(),
    findUpcoming: jest.fn(),
  }

  const syncRepo = {
    getByUserId: jest.fn(),
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-27T07:00:00.000Z'))
    jest.clearAllMocks()

    MockMeetingRepo.mockImplementation(() => meetingRepo as any)
    MockSyncRepo.mockImplementation(() => syncRepo as any)

    mockRequireMeetingParticipant.mockResolvedValue({
      session: {
        user: {
          id: 'user-1',
          email: 'alice@example.com',
          tenantId: 'tenant-1',
        },
      } as any,
      error: null,
    })

    meetingRepo.findById.mockResolvedValue({
      id: 'meeting-1',
      title: 'Project Sync',
      startTime: new Date('2026-04-27T09:00:00.000Z'),
      endTime: new Date('2026-04-27T10:00:00.000Z'),
    })

    meetingRepo.findUpcoming.mockResolvedValue([
      {
        id: 'meeting-1',
        title: 'Project Sync',
        startTime: new Date('2026-04-27T09:00:00.000Z'),
        endTime: new Date('2026-04-27T10:00:00.000Z'),
      },
      {
        id: 'meeting-2',
        title: 'Project Architecture',
        startTime: new Date('2026-04-27T11:00:00.000Z'),
        endTime: new Date('2026-04-27T12:00:00.000Z'),
      },
    ])

    syncRepo.getByUserId.mockResolvedValue({
      workDayStart: '09:00',
      workDayEnd: '17:00',
      focusTimeSlots: [{ dayOfWeek: 1, startTime: '13:00', endTime: '14:00' }],
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns auth error when tenant membership check fails', async () => {
    mockRequireMeetingParticipant.mockResolvedValueOnce({
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })

    const response = await GET(new Request('http://localhost/api/meetings/meeting-1/optimization-suggestions'), {
      params: { id: 'meeting-1' },
    })

    expect(response.status).toBe(403)
  })

  it('returns suggestions for a valid meeting', async () => {
    const response = await GET(new Request('http://localhost/api/meetings/meeting-1/optimization-suggestions'), {
      params: { id: 'meeting-1' },
    })

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload.meetingId).toBe('meeting-1')
    expect(Array.isArray(payload.suggestions)).toBe(true)
    expect(payload.suggestions.length).toBeGreaterThan(0)
    expect(payload.suggestions[0]).toMatchObject({
      id: expect.stringContaining('meeting-1-'),
      reason: expect.any(String),
      score: expect.any(Number),
    })

    expect(syncRepo.getByUserId).toHaveBeenCalledWith('user-1')
    expect(meetingRepo.findUpcoming).toHaveBeenCalledWith(120, expect.any(Date), 'tenant-1', 'alice@example.com')
  })

  it('returns 404 when meeting cannot be found', async () => {
    meetingRepo.findById.mockResolvedValueOnce(null)

    const response = await GET(new Request('http://localhost/api/meetings/missing/optimization-suggestions'), {
      params: { id: 'missing' },
    })

    expect(response.status).toBe(404)
  })
})
