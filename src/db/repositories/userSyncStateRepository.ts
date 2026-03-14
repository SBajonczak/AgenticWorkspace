import { prisma } from '../prisma'

export class UserSyncStateRepository {
  private get client(): any {
    return prisma as any
  }

  async getByUserId(userId: string): Promise<any | null> {
    return this.client.userSyncState.findUnique({ where: { userId } })
  }

  async upsert(userId: string, data: Record<string, unknown>): Promise<any> {
    return this.client.userSyncState.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    })
  }

  async markProcessing(userId: string, isProcessing: boolean, nextRunAt?: Date): Promise<any> {
    return this.client.userSyncState.upsert({
      where: { userId },
      create: {
        userId,
        isProcessing,
        nextRunAt,
      },
      update: {
        isProcessing,
        ...(nextRunAt ? { nextRunAt } : {}),
      },
    })
  }

  async markRunSuccess(userId: string, nextRunAt?: Date): Promise<any> {
    const now = new Date()
    return this.client.userSyncState.upsert({
      where: { userId },
      create: {
        userId,
        isProcessing: false,
        lastRunAt: now,
        lastSuccessAt: now,
        nextRunAt,
        lastError: null,
      },
      update: {
        isProcessing: false,
        lastRunAt: now,
        lastSuccessAt: now,
        nextRunAt,
        lastError: null,
      },
    })
  }

  async markRunError(userId: string, error: string, options?: { consentRequired?: boolean; nextRunAt?: Date }): Promise<any> {
    const now = new Date()
    return this.client.userSyncState.upsert({
      where: { userId },
      create: {
        userId,
        isProcessing: false,
        lastRunAt: now,
        lastError: error,
        consentRequired: options?.consentRequired ?? false,
        ...(options?.nextRunAt ? { nextRunAt: options.nextRunAt } : {}),
      },
      update: {
        isProcessing: false,
        lastRunAt: now,
        lastError: error,
        ...(typeof options?.consentRequired === 'boolean' ? { consentRequired: options.consentRequired } : {}),
        ...(options?.nextRunAt ? { nextRunAt: options.nextRunAt } : {}),
      },
    })
  }

  async setTokenState(userId: string, hasRefreshToken: boolean, consentRequired: boolean): Promise<any> {
    return this.client.userSyncState.upsert({
      where: { userId },
      create: {
        userId,
        hasRefreshToken,
        consentRequired,
      },
      update: {
        hasRefreshToken,
        consentRequired,
      },
    })
  }
}
