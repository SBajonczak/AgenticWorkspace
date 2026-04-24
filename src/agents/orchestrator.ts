import OpenAI from 'openai'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createInProcessMcpClient } from '@/mcp/client'
import { SummarizationAgent } from './summarize/summarizationAgent'
import { KeyPointsAgent } from './keypoints/keyPointsAgent'
import { ProjectMatchingAgent } from './project/projectMatchingAgent'
import { TicketAgent } from './ticket/ticketAgent'
import type {
  MeetingContext,
  AgentPipelineResult,
  AgentResult,
  SummarizationOutput,
  KeyPointsOutput,
  ProjectMatchOutput,
  TicketOutput,
} from './types'
import { ITicketProvider } from '@/tickets/types'

export interface OrchestratorConfig {
  openai: OpenAI
  model: string
  ticketProvider: ITicketProvider
}

function wrapSettledResult<T>(result: PromiseSettledResult<T>): AgentResult<T> {
  if (result.status === 'fulfilled') {
    return { status: 'fulfilled', value: result.value }
  }
  const reason =
    result.reason instanceof Error ? result.reason.message : String(result.reason)
  return { status: 'rejected', reason }
}

export class MeetingPipelineOrchestrator {
  private summarizationAgent: SummarizationAgent
  private keyPointsAgent: KeyPointsAgent
  private projectMatchingAgent: ProjectMatchingAgent
  private ticketAgent: TicketAgent

  constructor(
    private mcpServer: McpServer,
    private config: OrchestratorConfig
  ) {
    const { openai, model } = config
    this.summarizationAgent = new SummarizationAgent(openai, model)
    this.keyPointsAgent = new KeyPointsAgent(openai, model)
    this.projectMatchingAgent = new ProjectMatchingAgent(openai, model)
    this.ticketAgent = new TicketAgent()
  }

  async run(context: MeetingContext): Promise<AgentPipelineResult> {
    const startTime = Date.now()

    // One shared MCP client for the entire pipeline run
    const client = await createInProcessMcpClient(this.mcpServer)

    console.log(
      `[Orchestrator] Starting pipeline for meeting "${context.title}" (${context.meetingDbId})`
    )

    // ─── Phase 1: Parallel ───────────────────────────────────────────────────
    console.log(`[Orchestrator] Phase 1: SummarizationAgent + KeyPointsAgent (parallel)`)
    const [summarizationSettled, keyPointsSettled] = await Promise.allSettled([
      this.summarizationAgent.run(context, client),
      this.keyPointsAgent.run(context, client),
    ])

    const summarization: AgentResult<SummarizationOutput> = wrapSettledResult(summarizationSettled)
    const keyPoints: AgentResult<KeyPointsOutput> = wrapSettledResult(keyPointsSettled)

    if (summarization.status === 'rejected') {
      console.error(`[Orchestrator] SummarizationAgent failed: ${summarization.reason}`)
    }
    if (keyPoints.status === 'rejected') {
      console.error(`[Orchestrator] KeyPointsAgent failed: ${keyPoints.reason}`)
    }

    // ─── Phase 2: Parallel (depends on Phase 1 outputs) ─────────────────────
    console.log(`[Orchestrator] Phase 2: ProjectMatchingAgent + TicketAgent (parallel)`)

    const keyPointsValue = keyPoints.status === 'fulfilled' ? keyPoints.value : null

    const [projectMatchingSettled, ticketsSettled] = await Promise.allSettled([
      this.projectMatchingAgent.run(
        {
          ...context,
          todos: keyPointsValue?.todos ?? [],
          savedTodoIds: keyPointsValue?.savedTodoIds ?? [],
        },
        client
      ),
      this.ticketAgent.run(
        {
          meetingDbId: context.meetingDbId,
          meetingTitle: context.title,
          savedTodoIds: keyPointsValue?.savedTodoIds ?? [],
          ticketProviderType: this.config.ticketProvider.type,
        },
        client
      ),
    ])

    const projectMatching: AgentResult<ProjectMatchOutput> = wrapSettledResult(projectMatchingSettled)
    const tickets: AgentResult<TicketOutput> = wrapSettledResult(ticketsSettled)

    if (projectMatching.status === 'rejected') {
      console.error(`[Orchestrator] ProjectMatchingAgent failed: ${projectMatching.reason}`)
    }
    if (tickets.status === 'rejected') {
      console.error(`[Orchestrator] TicketAgent failed: ${tickets.reason}`)
    }

    // ─── Aggregate ───────────────────────────────────────────────────────────
    const durationMs = Date.now() - startTime
    const totalTokensUsed =
      (summarization.status === 'fulfilled' ? summarization.value.tokensUsed : 0) +
      (keyPoints.status === 'fulfilled' ? keyPoints.value.tokensUsed : 0) +
      (projectMatching.status === 'fulfilled' ? projectMatching.value.tokensUsed : 0)

    console.log(
      `[Orchestrator] Pipeline complete for "${context.title}" | ${durationMs}ms | ~${totalTokensUsed} tokens`
    )

    return {
      meetingDbId: context.meetingDbId,
      durationMs,
      totalTokensUsed,
      summarization,
      keyPoints,
      projectMatching,
      tickets,
    }
  }
}
