import type { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'

// Re-export for convenience
export type { McpClient }

// ─── Base Agent interface ────────────────────────────────────────────────────

export interface Agent<TInput, TOutput> {
  readonly name: string
  run(input: TInput, client: McpClient): Promise<TOutput>
}

// ─── Shared meeting context passed to every agent ───────────────────────────

export interface MeetingContext {
  meetingDbId: string
  meetingId: string
  title: string
  organizer: string
  organizerEmail?: string | null
  startTime: Date
  endTime: Date
  transcript: string
  participants: string[]
  tenantId?: string | null
  outputLanguages: string[]
  ownerIdentity?: { oid?: string | null; tid?: string | null; name?: string | null }
}

// ─── Per-agent result shapes ─────────────────────────────────────────────────

export interface SummarizationOutput {
  summary: string
  decisions: string[]
  minutesPerLanguage: Record<string, string>
  tokensUsed: number
}

export interface RawTodo {
  title: string
  description: string
  assigneeHint: string | null
  confidence: number
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
}

export interface SavedTodo extends RawTodo {
  id: string
  projectId: string | null
}

export interface KeyPointsOutput {
  todos: RawTodo[]
  savedTodoIds: string[]
  tokensUsed: number
}

export interface ProjectMatchOutput {
  projectStatusesCreated: number
  todoProjectMappings: Record<string, string | null> // todoId → projectId | null
  tokensUsed: number
}

export interface TicketOutput {
  ticketsSynced: number
  ticketsFailed: number
}

// ─── Orchestrator pipeline result ────────────────────────────────────────────

export type AgentSuccess<T> = { status: 'fulfilled'; value: T }
export type AgentError = { status: 'rejected'; reason: string }
export type AgentResult<T> = AgentSuccess<T> | AgentError

export interface AgentPipelineResult {
  meetingDbId: string
  durationMs: number
  totalTokensUsed: number
  summarization: AgentResult<SummarizationOutput>
  keyPoints: AgentResult<KeyPointsOutput>
  projectMatching: AgentResult<ProjectMatchOutput>
  tickets: AgentResult<TicketOutput>
}

export function isSuccess<T>(result: AgentResult<T>): result is AgentSuccess<T> {
  return result.status === 'fulfilled'
}

// ─── Adapter: AgentPipelineResult → legacy ProcessingResult numbers ──────────

export function extractCounts(result: AgentPipelineResult): {
  todosCreated: number
  minutesCreated: number
  projectStatusesCreated: number
  ticketsSynced: number
  ticketsFailed: number
} {
  return {
    todosCreated: isSuccess(result.keyPoints) ? result.keyPoints.value.savedTodoIds.length : 0,
    minutesCreated: isSuccess(result.summarization)
      ? Object.keys(result.summarization.value.minutesPerLanguage).length
      : 0,
    projectStatusesCreated: isSuccess(result.projectMatching)
      ? result.projectMatching.value.projectStatusesCreated
      : 0,
    ticketsSynced: isSuccess(result.tickets) ? result.tickets.value.ticketsSynced : 0,
    ticketsFailed: isSuccess(result.tickets) ? result.tickets.value.ticketsFailed : 0,
  }
}
