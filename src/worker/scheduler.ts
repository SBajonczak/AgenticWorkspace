import cron from 'node-cron'
import { createAppGraphAuth } from '../graph/appAuth'
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
import { createTicketProvider, createTicketProviderFromEnv } from '../tickets/factory'

let isRunning = false

async function runAgentCycle(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] Previous run still in progress, skipping.')
    return
  }

  isRunning = true
  try {
    console.log(`[Worker] Starting agent cycle at ${new Date().toISOString()}`)

    // IMPORTANT: Uses ClientSecretCredential (app permissions) – no interactive login.
    // GRAPH_TARGET_USER_ID must be the UPN or Azure AD object ID of the target user.
    const targetUserId = process.env.GRAPH_TARGET_USER_ID
    if (!targetUserId) {
      throw new Error(
        'GRAPH_TARGET_USER_ID is required. Set it to the UPN or Azure AD object ID of the target M365 user.'
      )
    }

    const appAuth = createAppGraphAuth()
    const accessToken = await appAuth.getAccessToken()

    const meetingsClient = new MeetingsClient(accessToken, targetUserId)
    const transcriptsClient = new TranscriptsClient(accessToken, targetUserId)

    const meetings = await meetingsClient.getLatestMeeting()
    if (!meetings || meetings.length === 0) {
      console.log('[Worker] No meetings found.')
      return
    }

    // Resolve tenant for ticket provider (per-tenant config wins over env fallback)
    const azureTenantId = process.env.AZURE_TENANT_ID
    const tenantRepo = new TenantRepository()
    let ticketProvider = createTicketProviderFromEnv()
    let tenantId: string | undefined

    if (azureTenantId) {
      const tenant = await tenantRepo.findOrCreate(azureTenantId)
      tenantId = tenant.id
      const tenantConfig = await tenantRepo.getTicketConfig(tenant.id)
      if (tenantConfig) {
        ticketProvider = createTicketProvider(tenantConfig)
        console.log(`[Worker] Using tenant ticket provider: ${ticketProvider.type}`)
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

    let processed = 0
    let skipped = 0
    let failed = 0

    for (const meeting of meetings) {
      if (!meeting.id) { skipped++; continue }

      try {
        const existing = await meetingRepo.findByMeetingId(meeting.id)
        if (existing?.processedAt) { skipped++; continue }

        const transcript = await transcriptsClient.getTranscript(meeting.id)
        if (!transcript) {
          console.warn(`[Worker] No transcript for "${meeting.subject}" -- skipping`)
          skipped++
          continue
        }

        const result = await processor.processMeeting(
          meeting.id,
          meeting.subject,
          meeting.organizer.emailAddress.name,
          meeting.organizer.emailAddress.address,
          new Date(meeting.start.dateTime),
          new Date(meeting.end.dateTime),
          transcript,
          meeting.participants || [],
          tenantId
        )

        processed++
        console.log(
          `[Worker] Processed: "${meeting.subject}" | ` +
          `Todos: ${result.todosCreated} | ` +
          `Tickets: ${result.ticketsSynced}/${result.todosCreated} synced`
        )
      } catch (err) {
        failed++
        console.error(`[Worker] Failed to process "${meeting.subject}":`, err)
      }
    }

    console.log(
      `[Worker] Cycle complete -- processed: ${processed}, skipped: ${skipped}, failed: ${failed}`
    )
  } catch (error) {
    console.error('[Worker] Unhandled error during agent cycle:', error)
  } finally {
    isRunning = false
  }
}

export function startWorker(intervalMinutes: number = 30): void {
  const cronExpression = `*/${intervalMinutes} * * * *`
  console.log(`[Worker] Scheduling agent every ${intervalMinutes} minutes`)

  cron.schedule(cronExpression, () => {
    runAgentCycle().catch((err) => console.error('[Worker] Scheduled cycle error:', err))
  })

  console.log('[Worker] Running initial cycle...')
  runAgentCycle().catch((err) => console.error('[Worker] Initial cycle error:', err))
}
