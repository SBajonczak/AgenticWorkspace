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
    expect(payload.timezone).toBe('Europe/Berlin')
    expect(payload.workDayStart).toBe('09:00')
    expect(payload.workDayEnd).toBe('17:00')
    expect(payload.focusTimeSlots).toEqual([])
  })
})

describe('PUT /api/user/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockAuth as any).mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('persists both lookahead and summary window', async () => {
    const upsertSchedulePreferences = jest.fn().mockResolvedValue({
      meetingLookaheadDays: 21,
      summaryWindowDays: 14,
      timezone: 'Europe/Berlin',
      workDayStart: '08:30',
      workDayEnd: '17:30',
      focusTimeSlots: [
        { id: 'slot-1', dayOfWeek: 1, startTime: '09:00', endTime: '11:00' },
      ],
    })

    MockRepo.mockImplementation(
      () =>
        ({
          upsertSchedulePreferences,
        }) as any
    )

    const res = await PUT(
      makeRequest({
        meetingLookaheadDays: 21,
        summaryWindowDays: 14,
        timezone: 'Europe/Berlin',
        workDayStart: '08:30',
        workDayEnd: '17:30',
        focusTimeSlots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '11:00' }],
      })
    )
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.meetingLookaheadDays).toBe(21)
    expect(payload.summaryWindowDays).toBe(14)
    expect(payload.timezone).toBe('Europe/Berlin')
    expect(payload.workDayStart).toBe('08:30')
    expect(payload.workDayEnd).toBe('17:30')
    expect(payload.focusTimeSlots).toEqual([
      { id: 'slot-1', dayOfWeek: 1, startTime: '09:00', endTime: '11:00' },
    ])

    expect(upsertSchedulePreferences).toHaveBeenCalledWith('user-1', {
      meetingLookaheadDays: 21,
      summaryWindowDays: 14,
      timezone: 'Europe/Berlin',
      workDayStart: '08:30',
      workDayEnd: '17:30',
      focusTimeSlots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '11:00' }],
    })
  })

  it('rejects invalid summary window', async () => {
    const res = await PUT(makeRequest({ meetingLookaheadDays: 14, summaryWindowDays: 0 }))
    expect(res.status).toBe(422)
  })

  it('rejects overlapping focus slots on the same day', async () => {
    const res = await PUT(
      makeRequest({
        meetingLookaheadDays: 14,
        summaryWindowDays: 7,
        workDayStart: '09:00',
        workDayEnd: '17:00',
        focusTimeSlots: [
          { dayOfWeek: 1, startTime: '10:00', endTime: '11:00' },
          { dayOfWeek: 1, startTime: '10:30', endTime: '11:30' },
        ],
      })
    )

    expect(res.status).toBe(422)
  })

  it('rejects focus slot outside working hours', async () => {
    const res = await PUT(
      makeRequest({
        meetingLookaheadDays: 14,
        summaryWindowDays: 7,
        workDayStart: '09:00',
        workDayEnd: '17:00',
        focusTimeSlots: [{ dayOfWeek: 2, startTime: '08:00', endTime: '09:30' }],
      })
    )

    expect(res.status).toBe(422)
  })
})
