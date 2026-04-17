/** @jest-environment node */

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/db/repositories/meetingRepository')

import { auth } from '@/lib/auth'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { GET } from '@/app/api/meetings/route'
import { NextRequest } from 'next/server'

const mockAuth = auth as jest.MockedFunction<typeof auth>
const MockMeetingRepo = MeetingRepository as jest.MockedClass<typeof MeetingRepository>

const mockMeetings = [
  {
    id: 'meeting-1',
    meetingId: 'ms-1',
    title: 'Sprint Review',
    organizer: 'Alice',
    organizerEmail: 'alice@example.com',
    startTime: new Date('2026-03-01T09:00:00Z'),
    endTime: new Date('2026-03-01T10:00:00Z'),
    summary: 'Reviewed sprint velocity.',
    processedAt: new Date('2026-03-01T11:00:00Z'),
    todos: [
      { id: 't1', ticketSync: { status: 'synced' } },
      { id: 't2', ticketSync: { status: 'pending' } },
    ],
  },
  {
    id: 'meeting-2',
    meetingId: 'ms-2',
    title: 'Design Review',
    organizer: 'Bob',
    organizerEmail: 'bob@example.com',
    startTime: new Date('2026-03-02T09:00:00Z'),
    endTime: new Date('2026-03-02T10:00:00Z'),
    summary: null,
    processedAt: null,
    todos: [],
  },
]

const mockFindLatest = jest.fn().mockResolvedValue(mockMeetings)
const request = new NextRequest('http://localhost/api/meetings')

describe('GET /api/meetings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockAuth as any).mockResolvedValue({
      user: { id: 'user-1', email: 'alice@example.com', tenantId: 'tenant-1' },
    });
    MockMeetingRepo.mockImplementation(() => ({ findLatest: mockFindLatest } as any))
  })

  it('returns 401 when not authenticated', async () => {
    ;(mockAuth as any).mockResolvedValue(null)
    const res = await GET(request)
    expect(res.status).toBe(401)
  })

  it('returns meeting list with todoCount and syncedCount', async () => {
    const res = await GET(request)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toHaveLength(2)

    const sprint = data.find((m: any) => m.id === 'meeting-1')
    expect(sprint.title).toBe('Sprint Review')
    expect(sprint.todoCount).toBe(2)
    expect(sprint.syncedCount).toBe(1)
    expect(sprint.summary).toBe('Reviewed sprint velocity.')

    const design = data.find((m: any) => m.id === 'meeting-2')
    expect(design.todoCount).toBe(0)
    expect(design.syncedCount).toBe(0)
    expect(design.processedAt).toBeNull()
  })

  it('passes tenantId to repository for scoping', async () => {
    await GET(request)
    expect(mockFindLatest).toHaveBeenCalledWith(50, 'tenant-1', 'alice@example.com')
  })

  it('passes undefined tenantId when user has no tenant', async () => {
    ;(mockAuth as any).mockResolvedValue({ user: { id: 'u2', email: 'x@x.com' } })
    await GET(request)
    expect(mockFindLatest).toHaveBeenCalledWith(50, undefined, 'x@x.com')
  })
})
