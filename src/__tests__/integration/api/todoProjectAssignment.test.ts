/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/authz', () => ({
  requireAuth: jest.fn(),
  requireMeetingParticipant: jest.fn(),
}))
jest.mock('@/db/repositories/todoRepository')
jest.mock('@/db/repositories/projectRepository')

import { requireAuth, requireMeetingParticipant } from '@/lib/authz'
import { TodoRepository } from '@/db/repositories/todoRepository'
import { ProjectRepository } from '@/db/repositories/projectRepository'
import { PATCH } from '@/app/api/todos/[id]/route'

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockRequireMeetingParticipant = requireMeetingParticipant as jest.MockedFunction<typeof requireMeetingParticipant>
const MockTodoRepo = TodoRepository as jest.MockedClass<typeof TodoRepository>
const MockProjectRepo = ProjectRepository as jest.MockedClass<typeof ProjectRepository>

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/todos/todo-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/todos/[id]', () => {
  const mockTodoRepo = {
    findById: jest.fn(),
    assignProject: jest.fn(),
  }

  const mockProjectRepo = {
    findById: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()

    MockTodoRepo.mockImplementation(() => mockTodoRepo as any)
    MockProjectRepo.mockImplementation(() => mockProjectRepo as any)

    mockRequireAuth.mockResolvedValue({
      session: { user: { id: 'user-1', email: 'alice@example.com', tenantId: 'tenant-1' } } as any,
      error: null,
    })

    mockRequireMeetingParticipant.mockResolvedValue({
      session: { user: { id: 'user-1', email: 'alice@example.com', tenantId: 'tenant-1' } } as any,
      error: null,
    })

    mockTodoRepo.findById.mockResolvedValue({ id: 'todo-1', meetingId: 'meeting-internal-1' })
    mockTodoRepo.assignProject.mockResolvedValue({ id: 'todo-1', projectId: 'project-1' })
  })

  it('returns auth error from requireAuth', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await PATCH(makeRequest({ projectId: 'project-1' }), { params: { id: 'todo-1' } })
    expect(response.status).toBe(401)
  })

  it('updates project assignment for valid project', async () => {
    mockProjectRepo.findById.mockResolvedValue({
      id: 'project-1',
      tenantId: 'tenant-1',
      archived: false,
      status: 'active',
      confirmed: true,
    })

    const response = await PATCH(makeRequest({ projectId: 'project-1' }), { params: { id: 'todo-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockRequireMeetingParticipant).toHaveBeenCalledWith('meeting-internal-1')
    expect(mockTodoRepo.assignProject).toHaveBeenCalledWith('todo-1', 'project-1')
    expect(data.todo.projectId).toBe('project-1')
  })

  it('supports unassigning project with null', async () => {
    mockTodoRepo.assignProject.mockResolvedValue({ id: 'todo-1', projectId: null })

    const response = await PATCH(makeRequest({ projectId: null }), { params: { id: 'todo-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockTodoRepo.assignProject).toHaveBeenCalledWith('todo-1', null)
    expect(data.todo.projectId).toBeNull()
  })

  it('returns 400 for archived project', async () => {
    mockProjectRepo.findById.mockResolvedValue({
      id: 'project-1',
      tenantId: 'tenant-1',
      archived: true,
      status: 'archived',
      confirmed: true,
    })

    const response = await PATCH(makeRequest({ projectId: 'project-1' }), { params: { id: 'todo-1' } })
    expect(response.status).toBe(400)
  })

  it('returns 403 for project outside tenant scope', async () => {
    mockProjectRepo.findById.mockResolvedValue({
      id: 'project-2',
      tenantId: 'other-tenant',
      archived: false,
      status: 'active',
      confirmed: true,
    })

    const response = await PATCH(makeRequest({ projectId: 'project-2' }), { params: { id: 'todo-1' } })
    expect(response.status).toBe(403)
  })

  it('returns 400 for unconfirmed project', async () => {
    mockProjectRepo.findById.mockResolvedValue({
      id: 'project-1',
      tenantId: 'tenant-1',
      archived: false,
      status: 'active',
      confirmed: false,
    })

    const response = await PATCH(makeRequest({ projectId: 'project-1' }), { params: { id: 'todo-1' } })
    expect(response.status).toBe(400)
  })
})
