import { MeetingProcessor } from './meetingProcessor'
import { createLLMClient } from '../ai/llmClient'
import { MeetingRepository } from '../db/repositories/meetingRepository'
import { TodoRepository } from '../db/repositories/todoRepository'
import { JiraSyncRepository } from '../db/repositories/jiraSyncRepository'
import { createJiraClient } from '../jira/client'
import { createGraphAuth } from '../graph/auth'
import { MeetingsClient } from '../graph/meetings'
import { TranscriptsClient } from '../graph/transcripts'

export interface AgentRunResult {
  success: boolean
  meetingId?: string
  meetingTitle?: string
  todosCreated?: number
  jiraSynced?: number
  error?: string
  dryRun: boolean
}

export class AgentRunner {
  private dryRun: boolean

  constructor(dryRun: boolean = false) {
    this.dryRun = dryRun
  }

  async run(): Promise<AgentRunResult> {
    try {
      console.log('\n' + '='.repeat(60))
      console.log('🤖 AGENTIC WORKSPACE - AGENT RUN')
      console.log('='.repeat(60))
      console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'PRODUCTION'}`)
      console.log('='.repeat(60) + '\n')

      // Initialize repositories
      const meetingRepo = new MeetingRepository()
      const todoRepo = new TodoRepository()
      const jiraSyncRepo = new JiraSyncRepository()

      // Get latest meeting from Graph API
      console.log('📞 Fetching latest meeting from Microsoft Graph...')
      const graphAuth = createGraphAuth()
      const accessToken = await graphAuth.getAccessToken()
      
      const meetingsClient = new MeetingsClient(accessToken)
      const latestMeeting = await meetingsClient.getLatestMeeting()

      if (!latestMeeting) {
        return {
          success: false,
          error: 'No meetings found',
          dryRun: this.dryRun,
        }
      }

      console.log(`Found meeting: ${latestMeeting.subject}`)

      // Get transcript
      console.log('📝 Fetching transcript...')
      const transcriptsClient = new TranscriptsClient(accessToken)
      const transcript = await transcriptsClient.getTranscript(latestMeeting.id)

      if (!transcript) {
        return {
          success: false,
          error: 'No transcript available for this meeting',
          dryRun: this.dryRun,
        }
      }

      if (this.dryRun) {
        console.log('\n✅ DRY RUN: Would process meeting with transcript')
        console.log(`Meeting: ${latestMeeting.subject}`)
        console.log(`Transcript length: ${transcript.length} characters`)
        return {
          success: true,
          meetingTitle: latestMeeting.subject,
          dryRun: true,
        }
      }

      // Process meeting with LLM
      console.log('🧠 Processing meeting with AI agent...')
      const llmClient = createLLMClient()
      const processor = new MeetingProcessor(llmClient, meetingRepo, todoRepo)

      const result = await processor.processMeeting(
        latestMeeting.id,
        latestMeeting.subject,
        latestMeeting.organizer.emailAddress.name,
        latestMeeting.organizer.emailAddress.address,
        new Date(latestMeeting.start.dateTime),
        new Date(latestMeeting.end.dateTime),
        transcript
      )

      console.log(`\n✅ Meeting processed successfully`)
      console.log(`Summary: ${result.agentResponse.meetingSummary.summary.substring(0, 100)}...`)
      console.log(`Decisions: ${result.agentResponse.meetingSummary.decisions.length}`)
      console.log(`TODOs: ${result.todosCreated}`)

      // Sync to Jira
      let jiraSynced = 0
      const jiraClient = createJiraClient()
      
      if (jiraClient) {
        console.log('\n📋 Syncing TODOs to Jira...')
        const todos = await todoRepo.findByMeetingId(result.meeting.id)
        
        for (const todo of todos) {
          try {
            const jiraIssue = await jiraClient.createTask({
              summary: todo.title,
              description: todo.description,
              assignee: todo.assigneeHint || undefined,
            })

            await jiraSyncRepo.markSynced(todo.id, jiraIssue.key, jiraIssue.id)
            console.log(`  ✓ Created: ${jiraIssue.key}`)
            jiraSynced++
          } catch (error) {
            console.error(`  ✗ Failed to sync todo ${todo.id}:`, error)
            await jiraSyncRepo.markFailed(
              todo.id,
              error instanceof Error ? error.message : 'Unknown error'
            )
          }
        }
      } else {
        console.log('\n⚠️  Jira client not configured. Skipping Jira sync.')
      }

      console.log('\n' + '='.repeat(60))
      console.log('✨ AGENT RUN COMPLETE')
      console.log('='.repeat(60) + '\n')

      return {
        success: true,
        meetingId: result.meeting.id,
        meetingTitle: result.meeting.title,
        todosCreated: result.todosCreated,
        jiraSynced,
        dryRun: false,
      }
    } catch (error) {
      console.error('❌ Agent run failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        dryRun: this.dryRun,
      }
    }
  }
}
