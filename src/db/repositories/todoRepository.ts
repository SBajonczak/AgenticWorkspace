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
        jiraSync: true,
        meeting: true,
      },
    })
  }

  async findByMeetingId(meetingId: string): Promise<Todo[]> {
    return prisma.todo.findMany({
      where: { meetingId },
      include: {
        jiraSync: true,
      },
      orderBy: { confidence: 'desc' },
    })
  }

  async update(id: string, data: Prisma.TodoUpdateInput): Promise<Todo> {
    return prisma.todo.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.todo.delete({ where: { id } })
  }
}
