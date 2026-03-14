import { prisma } from '../prisma'
import { TicketSync } from '@prisma/client'
import { TicketResult } from '@/tickets/types'

export class TicketSyncRepository {
  async findByTodoId(todoId: string): Promise<TicketSync | null> {
    return prisma.ticketSync.findUnique({ where: { todoId } })
  }

  async markSynced(todoId: string, result: TicketResult): Promise<TicketSync> {
    return prisma.ticketSync.upsert({
      where: { todoId },
      update: {
        provider: result.provider,
        ticketKey: result.key,
        ticketId: result.id,
        ticketUrl: result.url,
        status: 'synced',
        error: null,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        todoId,
        provider: result.provider,
        ticketKey: result.key,
        ticketId: result.id,
        ticketUrl: result.url,
        status: 'synced',
        syncedAt: new Date(),
      },
    })
  }

  async markFailed(todoId: string, provider: string, error: string): Promise<TicketSync> {
    return prisma.ticketSync.upsert({
      where: { todoId },
      update: {
        provider,
        status: 'failed',
        error,
        updatedAt: new Date(),
      },
      create: {
        todoId,
        provider,
        status: 'failed',
        error,
      },
    })
  }

  async findByMeetingId(meetingId: string): Promise<TicketSync[]> {
    // Join through todos
    const todos = await prisma.todo.findMany({
      where: { meetingId },
      include: { ticketSync: true },
    })
    return todos.map((t) => t.ticketSync).filter((s): s is TicketSync => s !== null)
  }

  async deletePendingByMeetingId(meetingId: string): Promise<void> {
    const todos = await prisma.todo.findMany({ where: { meetingId }, select: { id: true } })
    const todoIds = todos.map((t) => t.id)
    await prisma.ticketSync.deleteMany({
      where: { todoId: { in: todoIds }, status: 'pending' },
    })
  }
}
