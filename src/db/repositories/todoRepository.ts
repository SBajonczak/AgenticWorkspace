import { prisma } from '../prisma'
import { Todo, Prisma } from '@prisma/client'

export class TodoRepository {
  async create(data: Prisma.TodoCreateInput): Promise<Todo> {
    return prisma.todo.create({ data })
  }

  async createMany(data: Prisma.TodoCreateManyInput[]): Promise<number> {
    const result = await prisma.todo.createMany({ data })
    return result.count
  }

  async findById(id: string): Promise<Todo | null> {
    return prisma.todo.findUnique({
      where: { id },
      include: {
        assigneeUser: true,
        ticketSync: true,
        meeting: true,
      },
    }) as any
  }

  async findByMeetingId(meetingId: string): Promise<Todo[]> {
    return prisma.todo.findMany({
      where: { meetingId },
      include: { assigneeUser: true, ticketSync: true },
      orderBy: { confidence: 'desc' },
    }) as any
  }

  async findByProjectId(projectId: string): Promise<Todo[]> {
    return prisma.todo.findMany({
      where: { projectId },
      include: { assigneeUser: true, ticketSync: true, meeting: true },
      orderBy: [{ status: 'asc' }, { confidence: 'desc' }],
    }) as any
  }

  async assignProject(todoId: string, projectId: string | null): Promise<Todo> {
    return prisma.todo.update({
      where: { id: todoId },
      data: { projectId },
    })
  }

  async reassignProjectTodos(fromProjectId: string, toProjectId: string): Promise<number> {
    const result = await prisma.todo.updateMany({
      where: { projectId: fromProjectId },
      data: { projectId: toProjectId },
    })
    return result.count
  }

  async update(id: string, data: Prisma.TodoUncheckedUpdateInput): Promise<Todo> {
    return prisma.todo.update({ where: { id }, data })
  }

  async deleteByMeetingId(meetingId: string): Promise<void> {
    await prisma.todo.deleteMany({ where: { meetingId } })
  }

  async delete(id: string): Promise<void> {
    await prisma.todo.delete({ where: { id } })
  }
}
