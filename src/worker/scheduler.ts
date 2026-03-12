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
import { JiraSyncRepository } from '../db/repositories/jiraSyncRepository'
import { createJiraClient } from '../jira/client'

let isRunning = false

async function runAgentCycle(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] Previous run still in progress, skipping.')
    return
  }

  isRunning = true
  try {
    console.log(`[Worker] Starting agent cycle at ${new Date().toISOString()}`)

    // IMPORTANT: Use ClientSecretCredential (app permissions) for headless/daemon operation.
    // The DeviceCodeCredential used by AgentRunner requires interactive browser auth
    // and cannot run unattended. GRAPH_TARGET_USER_ID must be set to the UPN or
    // object ID of the M365 user whose meetings should be processed.
    const targetUserId = process.env.GRAPH_TARGET_USER_ID
    if (!targetUserId) {
      throw new Error(
        'GRAPH_TARGET_USER_ID is required for the background worker. ' +
          'Set it to the UPN (email) or Azure AD object ID of the target M365 user.'
      )
    }

    const appAuth = createAppGraphAuth()
    const accessToken = await appAuth.getAccessToken()

    // Use user-specific paths (/users/{id}/) since app permissions do not support /me/
    const meetingsClient = new MeetingsClient(accessToken, targetUserId)
    const transcriptsClient = new TranscriptsClient(accessToken, targetUserId)

    const meetings = await meetingsClient.getLatestMeeting()
    if (!meetings || meetings.length === 0) {
      console.log('[Worker] No meetings found.')
      return
    }

    const meetingRepo = new MeetingRepository()
    const todoRepo = new TodoRepository()
    const minutesRepo = new MeetingMinutesRepository()
    const projectStatusRepo = new ProjectStatusRepository()
    const jiraSyncRepo = new JiraSyncRepository()
    const llmClient = createLLMClient()
    const jiraClient = createJiraClient()

    const processor = new MeetingProcessor(
      llmClient,
      meetingRepo,
      todoRepo,
      minutesRepo,
      projectStatusRepo
    )

    let processed = 0
    let skipped = 0
    let failed = 0

    for (const meeting of meetings) {
      if (!meeting.id) {
        skipped++
        continue
      }

      try {
        // Skip already processed meetings
        const existing = await meetingRepo.findByMeetingId(meeting.id)
        if (existing?.processedAt) {
          skipped++
          continue
        }

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
          meeting.participants || []
        )

        // Sync todos to Jira
        if (jiraClient) {
          const todos = await todoRepo.findByMeetingId(result.meeting.id)
          for (const todo of todos) {
            try {
              const issue = await jiraClient.createTask({
                summary: todo.title,
                description: todo.description,
                assignee: todo.assigneeHint || undefined,
              })
              await jiraSyncRepo.markSynced(todo.id, issue.key, issue.id)
            } catch (err) {
              await jiraSyncRepo.markFailed(
                todo.id,
                err instanceof Error ? err.message : 'Unknown Jira error'
              )
            }
          }
        }

        processed++
        console.log(
          `[Worker] Processed: "${meeting.subject}" | Todos: ${result.todosCreated} | Minutes: ${result.minutesCreated}`
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
  console.log(`[Worker] Scheduling agent every ${intervalMinutes} minutes (${cronExpression})`)

  cron.schedule(cronExpression, () => {
    runAgentCycle().catch((err) => console.error('[Worker] Scheduled cycle error:', err))
  })

  // Run once immediately on startup
  console.log('[Worker] Running initial cycle...')
  runAgentCycle().catch((err) => console.error('[Worker] Initial cycle error:', err))
}
