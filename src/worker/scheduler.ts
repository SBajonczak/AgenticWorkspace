import cron from 'node-cron'
import { prisma } from '../db/prisma'
import { MeetingsClient } from '../graph/meetings'
import { TranscriptsClient } from '../graph/transcripts'
import { MeetingProcessor } from '../agent/meetingProcessor'
import { createLLMClient } from '../ai/llmClient'
import { MeetingRepository } from '../db/repositories/meetingRepository'
import { TodoRepository } from '../db/repositories/todoRepository'
import { MeetingMinutesRepository } from '../db/repositories/meetingMinutesRepository'
import { ProjectStatusRepository } from '../db/repositories/projectStatusRepository'
import { TicketSyncRepository } from '../db/repositories/ticketSyncRepository'
import { TenantRepository } from '../db/repositories/tenantRepository'
import { UserSyncStateRepository } from '../db/repositories/userSyncStateRepository'
import { createTicketProvider, createTicketProviderFromEnv } from '../tickets/factory'
import { ReauthRequiredError, UserTokenService } from '../graph/userTokenService'

let isRunning = false
let configuredIntervalMinutes = 30

function normalizeParticipantEmails(userEmail: string | null | undefined, organizerEmail: string, participants?: string[]): string[] {
  const allParticipants = [
    ...(participants ?? []),
    organizerEmail,
    userEmail ?? '',
  ]

  return [...new Set(allParticipants.map((entry) => entry?.trim().toLowerCase()).filter(Boolean))]
}

function mergeParticipantLists(current?: string | null, incoming?: string[]): string[] {
  let currentParticipants: string[] = []
  if (current) {
    try {
      currentParticipants = (JSON.parse(current) as string[]).map((email) => email.toLowerCase())
    } catch {
      currentParticipants = []
    }
  }

  const nextParticipants = incoming?.map((email) => email.toLowerCase()) ?? []
  return [...new Set([...currentParticipants, ...nextParticipants])]
}

function getNextRunAt(intervalMinutes: number): Date {
  return new Date(Date.now() + intervalMinutes * 60 * 1000)
}

async function runForUser(user: { id: string; email: string | null; tenantId: string | null }, intervalMinutes: number): Promise<void> {
  const syncRepo = new UserSyncStateRepository()
  const tokenService = new UserTokenService(syncRepo)
  const nextRunAt = getNextRunAt(intervalMinutes)
  await syncRepo.markProcessing(user.id, true, nextRunAt)

  try {
    const accessToken = await tokenService.getValidAccessTokenForUser(user.id)
    const meetingsClient = new MeetingsClient(accessToken)
    const transcriptsClient = new TranscriptsClient(accessToken)

    const meetings = await meetingsClient.getLatestMeeting()
    if (!meetings || meetings.length === 0) {
      await syncRepo.markRunSuccess(user.id, nextRunAt)
      return
    }

    const tenantRepo = new TenantRepository()
    let ticketProvider = createTicketProviderFromEnv()

    if (user.tenantId) {
      const tenantConfig = await tenantRepo.getTicketConfig(user.tenantId)
      if (tenantConfig) {
        ticketProvider = createTicketProvider(tenantConfig)
      }
    }

    const meetingRepo = new MeetingRepository()
    const todoRepo = new TodoRepository()
    const minutesRepo = new MeetingMinutesRepository()
    const projectStatusRepo = new ProjectStatusRepository()
    const ticketSyncRepo = new TicketSyncRepository()
    const llmClient = createLLMClient()

    const processor = new MeetingProcessor(
      llmClient,
      meetingRepo,
      todoRepo,
      minutesRepo,
      projectStatusRepo,
      ticketSyncRepo,
      ticketProvider
    )

    for (const meeting of meetings) {
      if (!meeting.id) continue

      const organizerEmail = meeting.organizer.emailAddress.address.toLowerCase()
      const participants = normalizeParticipantEmails(user.email, organizerEmail, meeting.participants)

      const existing = await meetingRepo.findByMeetingId(meeting.id)
      if (existing?.processedAt) {
        const merged = mergeParticipantLists(existing.participants, participants)
        if (merged.length > 0) {
          await meetingRepo.update(existing.id, {
            participants: JSON.stringify(merged),
          })
        }
        continue
      }

      const transcript = await transcriptsClient.getTranscript(meeting.id)
      if (!transcript) {
        continue
      }

      await processor.processMeeting(
        meeting.id,
        meeting.subject,
        meeting.organizer.emailAddress.name,
        organizerEmail,
        new Date(meeting.start.dateTime),
        new Date(meeting.end.dateTime),
        transcript,
        participants,
        user.tenantId ?? undefined
      )
    }

    await syncRepo.markRunSuccess(user.id, nextRunAt)
  } catch (error) {
    if (error instanceof ReauthRequiredError) {
      await syncRepo.markRunError(user.id, error.message, { consentRequired: true, nextRunAt })
      return
    }

    await syncRepo.markRunError(
      user.id,
      error instanceof Error ? error.message : 'Unknown worker error',
      { nextRunAt }
    )
  }
}

export async function runAgentCycleForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      tenantId: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  await runForUser(user, configuredIntervalMinutes)
}

export async function runAgentCycle(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] Previous run still in progress, skipping.')
    return
  }

  isRunning = true
  try {
    console.log(`[Worker] Starting agent cycle at ${new Date().toISOString()}`)

    const users = await prisma.user.findMany({
      where: {
        accounts: {
          some: {
            provider: 'microsoft-entra-id',
          },
        },
      },
      select: {
        id: true,
        email: true,
        tenantId: true,
      },
    })

    for (const user of users) {
      await runForUser(user, configuredIntervalMinutes)
    }

    console.log(`[Worker] Cycle complete for ${users.length} user(s).`)
  } catch (error) {
    console.error('[Worker] Unhandled error during agent cycle:', error)
  } finally {
    isRunning = false
  }
}

export function startWorker(intervalMinutes: number = 30): void {
  configuredIntervalMinutes = intervalMinutes
  const cronExpression = `*/${intervalMinutes} * * * *`
  console.log(`[Worker] Scheduling agent every ${intervalMinutes} minutes`)

  cron.schedule(cronExpression, () => {
    runAgentCycle().catch((err) => console.error('[Worker] Scheduled cycle error:', err))
  })

  console.log('[Worker] Running initial cycle...')
  runAgentCycle().catch((err) => console.error('[Worker] Initial cycle error:', err))
}
