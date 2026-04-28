/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/authz', () => ({
  requireMeetingParticipant: jest.fn(),
}))
jest.mock('@/db/repositories/meetingRepository')
jest.mock('@/graph/userTokenService')
jest.mock('@/graph/meetings')
jest.mock('@/db/prisma', () => ({
  prisma: {
    account: {
      findFirst: jest.fn(),
    },
  },
}))

import { requireMeetingParticipant } from '@/lib/authz'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { UserTokenService } from '@/graph/userTokenService'
import { MeetingsClient } from '@/graph/meetings'
import { prisma } from '@/db/prisma'
import { POST } from '@/app/api/meetings/[id]/reschedule/route'

const mockRequireMeetingParticipant = requireMeetingParticipant as jest.MockedFunction<typeof requireMeetingParticipant>
const MockMeetingRepo = MeetingRepository as jest.MockedClass<typeof MeetingRepository>
const MockUserTokenService = UserTokenService as jest.MockedClass<typeof UserTokenService>
const MockMeetingsClient = MeetingsClient as jest.MockedClass<typeof MeetingsClient>
const mockPrisma = prisma as any

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/meetings/meeting-1/reschedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/meetings/[id]/reschedule', () => {
  const meetingRepo = {
    findById: jest.fn(),
    update: jest.fn(),
  }

  const tokenService = {
    getValidAccessTokenForUser: jest.fn(),
  }

  const meetingsClient = {
    findEventIdForMeetingWindow: jest.fn(),
    rescheduleEventById: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()

    MockMeetingRepo.mockImplementation(() => meetingRepo as any)
    MockUserTokenService.mockImplementation(() => tokenService as any)
    MockMeetingsClient.mockImplementation(() => meetingsClient as any)

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

    mockPrisma.account.findFirst.mockResolvedValue({ scope: 'Calendars.Read Calendars.ReadWrite User.Read' })
    tokenService.getValidAccessTokenForUser.mockResolvedValue('token-1')
    meetingsClient.findEventIdForMeetingWindow.mockResolvedValue('event-1')
    meetingsClient.rescheduleEventById.mockResolvedValue(undefined)
    meetingRepo.update.mockResolvedValue({ id: 'meeting-1' })
  })

  it('returns auth error when tenant membership check fails', async () => {
    mockRequireMeetingParticipant.mockResolvedValueOnce({
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })

    const response = await POST(makeRequest({
      targetStartTime: '2026-04-27T12:00:00.000Z',
      targetEndTime: '2026-04-27T13:00:00.000Z',
    }), { params: { id: 'meeting-1' } })

    expect(response.status).toBe(403)
  })

  it('returns 422 for invalid payload', async () => {
    const response = await POST(makeRequest({ targetStartTime: 'bad', targetEndTime: 'bad' }), {
      params: { id: 'meeting-1' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when write scope is missing', async () => {
    mockPrisma.account.findFirst.mockResolvedValueOnce({ scope: 'Calendars.Read User.Read' })

    const response = await POST(makeRequest({
      targetStartTime: '2026-04-27T12:00:00.000Z',
      targetEndTime: '2026-04-27T13:00:00.000Z',
    }), { params: { id: 'meeting-1' } })

    expect(response.status).toBe(403)
    expect(tokenService.getValidAccessTokenForUser).not.toHaveBeenCalled()
  })

  it('reschedules meeting and updates database window', async () => {
    const response = await POST(makeRequest({
      targetStartTime: '2026-04-27T12:00:00.000Z',
      targetEndTime: '2026-04-27T13:00:00.000Z',
    }), { params: { id: 'meeting-1' } })

    expect(response.status).toBe(200)

    expect(tokenService.getValidAccessTokenForUser).toHaveBeenCalledWith('user-1')
    expect(meetingsClient.findEventIdForMeetingWindow).toHaveBeenCalledWith({
      title: 'Project Sync',
      startTime: new Date('2026-04-27T09:00:00.000Z'),
      endTime: new Date('2026-04-27T10:00:00.000Z'),
    })
    expect(meetingsClient.rescheduleEventById).toHaveBeenCalledWith({
      eventId: 'event-1',
      startTime: new Date('2026-04-27T12:00:00.000Z'),
      endTime: new Date('2026-04-27T13:00:00.000Z'),
    })
    expect(meetingRepo.update).toHaveBeenCalledWith('meeting-1', {
      startTime: new Date('2026-04-27T12:00:00.000Z'),
      endTime: new Date('2026-04-27T13:00:00.000Z'),
    })
  })
})
