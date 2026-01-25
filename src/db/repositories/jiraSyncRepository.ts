import { prisma } from '../prisma'
import { JiraSync, Prisma } from '@prisma/client'

export class JiraSyncRepository {
  async create(data: Prisma.JiraSyncCreateInput): Promise<JiraSync> {
    return prisma.jiraSync.create({ data })
  }

  async findByTodoId(todoId: string): Promise<JiraSync | null> {
    return prisma.jiraSync.findUnique({
      where: { todoId },
      include: {
        todo: true,
      },
    })
  }

  async update(id: string, data: Prisma.JiraSyncUpdateInput): Promise<JiraSync> {
    return prisma.jiraSync.update({
      where: { id },
      data,
    })
  }

  async markSynced(
    todoId: string,
    jiraIssueKey: string,
    jiraIssueId: string
  ): Promise<JiraSync> {
    const existing = await this.findByTodoId(todoId)
    
    if (existing) {
      return this.update(existing.id, {
        jiraIssueKey,
        jiraIssueId,
        status: 'synced',
        syncedAt: new Date(),
        error: null,
      })
    }

    return this.create({
      todo: { connect: { id: todoId } },
      jiraIssueKey,
      jiraIssueId,
      status: 'synced',
      syncedAt: new Date(),
    })
  }

  async markFailed(todoId: string, error: string): Promise<JiraSync> {
    const existing = await this.findByTodoId(todoId)
    
    if (existing) {
      return this.update(existing.id, {
        status: 'failed',
        error,
      })
    }

    return this.create({
      todo: { connect: { id: todoId } },
      status: 'failed',
      error,
    })
  }
}
