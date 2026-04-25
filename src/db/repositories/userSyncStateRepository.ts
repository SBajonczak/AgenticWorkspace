import { prisma } from '../prisma'

interface FocusTimeSlotInput {
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface SchedulePreferenceInput {
  meetingLookaheadDays: number
  summaryWindowDays: number
  timezone: string
  workDayStart: string
  workDayEnd: string
  focusTimeSlots: FocusTimeSlotInput[]
}

export class UserSyncStateRepository {
  private get client(): any {
    return prisma as any
  }

  async getByUserId(userId: string): Promise<any | null> {
    return this.client.userSyncState.findUnique({
      where: { userId },
      include: {
        focusTimeSlots: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    })
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

  async markRunSuccess(userId: string, nextRunAt?: Date, lastMeetingSyncAt?: Date): Promise<any> {
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
        ...(lastMeetingSyncAt ? { lastMeetingSyncAt } : {}),
      },
      update: {
        isProcessing: false,
        lastRunAt: now,
        lastSuccessAt: now,
        nextRunAt,
        lastError: null,
        ...(lastMeetingSyncAt ? { lastMeetingSyncAt } : {}),
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

  async upsertSchedulePreferences(userId: string, data: SchedulePreferenceInput): Promise<any> {
    return this.client.userSyncState.upsert({
      where: { userId },
      create: {
        userId,
        meetingLookaheadDays: data.meetingLookaheadDays,
        summaryWindowDays: data.summaryWindowDays,
        timezone: data.timezone,
        workDayStart: data.workDayStart,
        workDayEnd: data.workDayEnd,
        focusTimeSlots: {
          create: data.focusTimeSlots,
        },
      },
      update: {
        meetingLookaheadDays: data.meetingLookaheadDays,
        summaryWindowDays: data.summaryWindowDays,
        timezone: data.timezone,
        workDayStart: data.workDayStart,
        workDayEnd: data.workDayEnd,
        focusTimeSlots: {
          deleteMany: {},
          create: data.focusTimeSlots,
        },
      },
      include: {
        focusTimeSlots: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    })
  }
}
