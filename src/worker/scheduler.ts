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

function clampLookaheadDays(value: unknown): number {
  const fallback = 14
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.trunc(parsed)
  return Math.max(1, Math.min(31, normalized))
}

function shouldDebugMeetingSync(): boolean {
  return process.env.DEBUG_GRAPH_MEETINGS !== 'false'
}

type MeetingRunStatus =
  | 'already_processed'
  | 'transcript_missing'
  | 'processed'
  | 'processing_failed'

interface MeetingRunSummaryItem {
  meetingId: string
  title: string
  transcriptAvailable: boolean
  transcribed: boolean
  status: MeetingRunStatus
}

async function runForUser(
  user: {
    id: string
    email: string | null
    tenantId: string | null
    aadObjectId: string | null
    azureTenantId: string | null
    name: string | null
  },
  intervalMinutes: number
): Promise<void> {
  const syncRepo = new UserSyncStateRepository()
  const tokenService = new UserTokenService(syncRepo)
  const nextRunAt = getNextRunAt(intervalMinutes)
  await syncRepo.markProcessing(user.id, true, nextRunAt)

  // Record the cycle start-time BEFORE the Graph call so we can use it as the
  // next checkpoint. Any meeting whose lastModifiedDateTime falls within this
  // window will then be picked up on the next run.
  const cycleStartedAt = new Date()

  try {
    const accessToken = await tokenService.getValidAccessTokenForUser(user.id)
    const meetingsClient = new MeetingsClient(accessToken)
    const transcriptsClient = new TranscriptsClient(accessToken)

    // Load the previous sync checkpoint so we can do a delta (incremental) query.
    const syncState = await syncRepo.getByUserId(user.id)
    const lastMeetingSyncAt: Date | null = (syncState as any)?.lastMeetingSyncAt ?? null

    const daysForward = clampLookaheadDays((syncState as any)?.meetingLookaheadDays)

    if (shouldDebugMeetingSync()) {
      console.log(
        `[Worker][Meetings] user=${user.id} checkpoint.before=${lastMeetingSyncAt ? lastMeetingSyncAt.toISOString() : 'null'} checkpoint.next=${cycleStartedAt.toISOString()} overlapHours=48 daysForward=${daysForward}`
      )
    }

    const meetings = await meetingsClient.getLatestMeeting({
      ...(lastMeetingSyncAt ? { startAfter: lastMeetingSyncAt } : {}),
      daysForward,
      overlapHours: 48,
    })
    if (!meetings || meetings.length === 0) {
      if (shouldDebugMeetingSync()) {
        console.log(
          `[Worker][Meetings] user=${user.id} fetched=0 checkpoint.persisted=${cycleStartedAt.toISOString()}`
        )
      }
      await syncRepo.markRunSuccess(user.id, nextRunAt, cycleStartedAt)
      return
    }

    if (shouldDebugMeetingSync()) {
      console.log(
        `[Worker][Meetings] user=${user.id} fetched=${meetings.length} checkpoint.persisted=${cycleStartedAt.toISOString()}`
      )
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

    const meetingRunSummary: MeetingRunSummaryItem[] = []

    for (const meeting of meetings) {
      if (!meeting.id) continue

      const organizerEmail = meeting.organizer.emailAddress.address.toLowerCase()
      const participants = normalizeParticipantEmails(user.email, organizerEmail, meeting.participants)
      const summaryItemBase = {
        meetingId: meeting.id,
        title: meeting.subject,
      }

      const existing = await meetingRepo.findByMeetingId(meeting.id)
      const graphModifiedAt = meeting.lastModifiedDateTime ? new Date(meeting.lastModifiedDateTime) : null

      if (existing?.processedAt) {
        // Strict once-processing: already processed meetings are never re-crawled.
        // Keep participant list and sync metadata fresh only.
        const merged = mergeParticipantLists(existing.participants, participants)
        if (merged.length > 0) {
          await meetingRepo.update(existing.id, {
            participants: JSON.stringify(merged),
          })
        }
        await meetingRepo.updateSyncMeta(existing.id, graphModifiedAt, new Date())
        meetingRunSummary.push({
          ...summaryItemBase,
          transcriptAvailable: Boolean(existing.transcript),
          transcribed: true,
          status: 'already_processed',
        })
        continue
      }

      // Brand-new meeting (not yet in DB).
      try {
        const transcript = await transcriptsClient.getTranscript(meeting.id)
        if (!transcript) {
          meetingRunSummary.push({
            ...summaryItemBase,
            transcriptAvailable: false,
            transcribed: false,
            status: 'transcript_missing',
          })
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
          user.tenantId ?? undefined,
          {
            oid: user.aadObjectId,
            tid: user.azureTenantId,
            name: user.name ?? user.email,
          }
        )

        // Persist sync metadata for the newly created meeting row.
        const created = await meetingRepo.findByMeetingId(meeting.id)
        if (created) {
          await meetingRepo.updateSyncMeta(created.id, graphModifiedAt, new Date())
        }

        meetingRunSummary.push({
          ...summaryItemBase,
          transcriptAvailable: true,
          transcribed: true,
          status: 'processed',
        })
      } catch (meetingError) {
        console.error(
          `[Worker][Meetings] Failed processing meeting "${meeting.subject}" (${meeting.id}) for user=${user.id}:`,
          meetingError
        )
        meetingRunSummary.push({
          ...summaryItemBase,
          transcriptAvailable: false,
          transcribed: false,
          status: 'processing_failed',
        })
      }
    }

    if (shouldDebugMeetingSync()) {
      const summaryPayload = {
        userId: user.id,
        userEmail: user.email,
        fetchedCount: meetings.length,
        checkpointBefore: lastMeetingSyncAt ? lastMeetingSyncAt.toISOString() : null,
        checkpointPersisted: cycleStartedAt.toISOString(),
        meetings: meetingRunSummary,
      }
      console.log(`[Worker][Meetings][Summary] ${JSON.stringify(summaryPayload)}`)
    }

    // Advance the delta-sync checkpoint to the start of this cycle.
    await syncRepo.markRunSuccess(user.id, nextRunAt, cycleStartedAt)
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
      aadObjectId: true,
      name: true,
      tenant: {
        select: {
          azureTenantId: true,
        },
      },
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  await runForUser(
    {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      aadObjectId: user.aadObjectId,
      azureTenantId: user.tenant?.azureTenantId ?? null,
      name: user.name,
    },
    configuredIntervalMinutes
  )
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
        aadObjectId: true,
        name: true,
        tenant: {
          select: {
            azureTenantId: true,
          },
        },
      },
    })

    for (const user of users) {
      await runForUser(
        {
          id: user.id,
          email: user.email,
          tenantId: user.tenantId,
          aadObjectId: user.aadObjectId,
          azureTenantId: user.tenant?.azureTenantId ?? null,
          name: user.name,
        },
        configuredIntervalMinutes
      )
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
