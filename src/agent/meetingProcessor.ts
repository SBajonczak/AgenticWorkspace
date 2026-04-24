import { LLMClient, AgentResponse } from '../ai/llmClient'
import { MeetingRepository } from '../db/repositories/meetingRepository'
import { TodoRepository } from '../db/repositories/todoRepository'
import { MeetingMinutesRepository } from '../db/repositories/meetingMinutesRepository'
import { ProjectStatusRepository } from '../db/repositories/projectStatusRepository'
import { ProjectRepository } from '../db/repositories/projectRepository'
import { TicketSyncRepository } from '../db/repositories/ticketSyncRepository'
import { ITicketProvider } from '../tickets/types'
import { NoneTicketProvider } from '../tickets/providers/none'
import { Meeting } from '@prisma/client'
import { MeetingPipelineOrchestrator } from '../agents/orchestrator'
import { createMcpServer, createDefaultMcpServerDeps } from '../mcp/server'
import { extractCounts, isSuccess } from '../agents/types'

export interface ProcessingResult {
  meeting: Meeting
  agentResponse: AgentResponse
  todosCreated: number
  minutesCreated: number
  projectStatusesCreated: number
  ticketsSynced: number
  ticketsFailed: number
}

export class MeetingProcessor {
  private projectRepo: ProjectRepository

  private normalizeProjectName(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private tokenize(value: string): string[] {
    return this.normalizeProjectName(value)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  }

  private buildAutoCreatedDescription(summary: string, meetingDate: Date): string {
    const prefix = `Auto-created from meeting transcript on ${meetingDate.toLocaleDateString()}`
    const trimmedSummary = summary.trim()
    if (!trimmedSummary) return prefix
    return `${prefix}. ${trimmedSummary}`.slice(0, 2000)
  }

  private dedupeProjectStatuses(projectStatuses: AgentResponse['projectStatuses']): AgentResponse['projectStatuses'] {
    const deduped = new Map<string, AgentResponse['projectStatuses'][number]>()

    for (const projectStatus of projectStatuses) {
      const normalizedName = this.normalizeProjectName(projectStatus.projectName)
      if (!normalizedName) continue

      const existing = deduped.get(normalizedName)
      if (!existing || projectStatus.summary.length > existing.summary.length) {
        deduped.set(normalizedName, {
          ...projectStatus,
          projectName: projectStatus.projectName.trim(),
          summary: projectStatus.summary.trim(),
        })
      }
    }

    return [...deduped.values()]
  }

  private matchTodoToProject(
    todo: AgentResponse['todos'][number],
    projects: Array<{ id: string; name: string; summary: string }>
  ): string | null {
    if (projects.length === 0) return null
    if (projects.length === 1) return projects[0].id

    const todoText = `${todo.title} ${todo.description}`
    const normalizedTodoText = this.normalizeProjectName(todoText)
    const todoTokens = this.tokenize(todoText)

    let bestProjectId: string | null = null
    let bestScore = 0

    for (const project of projects) {
      const normalizedProjectName = this.normalizeProjectName(project.name)
      const projectTokens = this.tokenize(`${project.name} ${project.summary}`)
      let score = 0

      if (normalizedProjectName && normalizedTodoText.includes(normalizedProjectName)) {
        score += 100
      }

      const tokenOverlap = todoTokens.filter((token) => projectTokens.includes(token)).length
      if (tokenOverlap > 0) {
        score += tokenOverlap * 10
      }

      if (score > bestScore) {
        bestScore = score
        bestProjectId = project.id
      }
    }

    return bestScore >= 20 ? bestProjectId : null
  }

  private orchestrator?: MeetingPipelineOrchestrator

  constructor(
    private llmClient: LLMClient,
    private meetingRepo: MeetingRepository,
    private todoRepo: TodoRepository,
    private minutesRepo: MeetingMinutesRepository,
    private projectStatusRepo: ProjectStatusRepository,
    private ticketSyncRepo: TicketSyncRepository = new TicketSyncRepository(),
    private ticketProvider: ITicketProvider = new NoneTicketProvider(),
    projectRepo?: ProjectRepository
  ) {
    this.projectRepo = projectRepo ?? new ProjectRepository()

    if (process.env.USE_MULTI_AGENT_PIPELINE === 'true') {
      const openai = (this.llmClient as any).client as import('openai').default
      const model = (this.llmClient as any).model as string
      const mcpDeps = createDefaultMcpServerDeps(this.ticketProvider)
      const mcpServer = createMcpServer(mcpDeps)
      this.orchestrator = new MeetingPipelineOrchestrator(mcpServer, {
        openai,
        model,
        ticketProvider: this.ticketProvider,
      })
    }
  }

  async processMeeting(
    meetingId: string,
    title: string,
    organizer: string,
    organizerEmail: string | undefined,
    startTime: Date,
    endTime: Date,
    transcript: string,
    participants: string[] = [],
    tenantId?: string,
    ownerIdentity?: { oid?: string | null; tid?: string | null; name?: string | null },
    indexingMeta?: {
      indexedForUserId?: string | null
      indexedForUserEmail?: string | null
      indexedByUserId?: string | null
      indexedByUserEmail?: string | null
      isRecrawl?: boolean
    }
  ): Promise<ProcessingResult> {
    // Upsert meeting record – use (meetingId, startTime) composite key so that
    // each occurrence of a recurring meeting series gets its own independent row.
    const existingMeeting = await this.meetingRepo.findByMeetingIdAndStartTime(meetingId, startTime)
    let meeting: Meeting

    if (!existingMeeting) {
      meeting = await this.meetingRepo.create({
        meetingId,
        title,
        organizer,
        organizerEmail,
        startTime,
        endTime,
        transcript,
        participants: JSON.stringify(participants),
        indexedAt: new Date(),
        indexedForUserId: indexingMeta?.indexedForUserId ?? null,
        indexedForUserEmail: indexingMeta?.indexedForUserEmail ?? null,
        indexedByUserId: indexingMeta?.indexedByUserId ?? null,
        indexedByUserEmail: indexingMeta?.indexedByUserEmail ?? null,
        ...(tenantId ? { tenant: { connect: { id: tenantId } } } : {}),
      })
    } else {
      meeting = await this.meetingRepo.update(existingMeeting.id, {
        participants: JSON.stringify(participants),
        indexedAt: new Date(),
        ...(indexingMeta?.indexedForUserId ? { indexedForUserId: indexingMeta.indexedForUserId } : {}),
        ...(indexingMeta?.indexedForUserEmail ? { indexedForUserEmail: indexingMeta.indexedForUserEmail } : {}),
        ...(indexingMeta?.indexedByUserId ? { indexedByUserId: indexingMeta.indexedByUserId } : {}),
        ...(indexingMeta?.indexedByUserEmail ? { indexedByUserEmail: indexingMeta.indexedByUserEmail } : {}),
        ...(indexingMeta?.isRecrawl
          ? {
              recrawlCount: { increment: 1 },
              lastRecrawlAt: new Date(),
            }
          : {}),
      })
    }

    // ─── Multi-Agent Pipeline (feature-flagged) ──────────────────────────────
    if (this.orchestrator) {
      console.log(`[Processor] Using multi-agent pipeline for "${title}"`)
      const pipelineResult = await this.orchestrator.run({
        meetingDbId: meeting.id,
        meetingId,
        title,
        organizer,
        organizerEmail,
        startTime,
        endTime,
        transcript,
        participants,
        tenantId,
        outputLanguages: (this.llmClient as any).outputLanguages as string[],
        ownerIdentity,
      })

      const counts = extractCounts(pipelineResult)
      const summaryValue = isSuccess(pipelineResult.summarization)
        ? pipelineResult.summarization.value
        : null

      // Build a minimal AgentResponse for callers that inspect the return value
      const agentResponse: AgentResponse = {
        meetingSummary: {
          summary: summaryValue?.summary ?? '',
          decisions: summaryValue?.decisions ?? [],
        },
        projectStatuses: [],
        todos: [],
        meetingMinutes: summaryValue?.minutesPerLanguage ?? {},
      }

      return {
        meeting,
        agentResponse,
        todosCreated: counts.todosCreated,
        minutesCreated: counts.minutesCreated,
        projectStatusesCreated: counts.projectStatusesCreated,
        ticketsSynced: counts.ticketsSynced,
        ticketsFailed: counts.ticketsFailed,
      }
    }

    // ─── Legacy single-LLM pipeline ──────────────────────────────────────────
    console.log(`[Processor] Analysing meeting: ${title}`)
    console.log(`[Processor] Transcript length: ${transcript.length} chars | Participants: ${participants.length}`)
    console.log(`[Processor] Meeting: ${startTime.toISOString()} → ${endTime.toISOString()} | Organizer: ${organizer}`)
    const agentResponse = await this.llmClient.processTranscript(
      { title, organizer, startTime, endTime },
      transcript
    )
    const dedupedProjectStatuses = this.dedupeProjectStatuses(agentResponse.projectStatuses)
    console.log(
      `[Processor] Extracted ${dedupedProjectStatuses.length} project candidates and ${agentResponse.todos.length} todos from meeting "${title}"`
    )

    // Persist summary + decisions
    meeting = await this.meetingRepo.update(meeting.id, {
      summary: agentResponse.meetingSummary.summary,
      decisions: JSON.stringify(agentResponse.meetingSummary.decisions),
      processedAt: new Date(),
    })

    // Persist project statuses – match against managed projects by name/alias
    await this.projectStatusRepo.deleteByMeetingId(meeting.id)
    let projectStatusesCreated = 0
    const resolvedProjects: Array<{ id: string; name: string; summary: string }> = []

    if (dedupedProjectStatuses.length > 0) {
      const statusData = await Promise.all(
        dedupedProjectStatuses.map(async (projectStatus) => {
          const matched = await this.projectRepo.findOrCreateByNameOrAlias(
            projectStatus.projectName,
            tenantId,
            {
              description: this.buildAutoCreatedDescription(projectStatus.summary, startTime),
              confirmed: false,
              owner:
                ownerIdentity?.oid && ownerIdentity?.tid
                  ? {
                      oid: ownerIdentity.oid,
                      tid: ownerIdentity.tid,
                      name: ownerIdentity.name ?? null,
                    }
                  : undefined,
            }
          )

          console.log(
            `[Processor] Resolved project "${projectStatus.projectName}" as "${matched.name}"`
          )

          if (matched) {
            resolvedProjects.push({
              id: matched.id,
              name: matched.name,
              summary: projectStatus.summary,
            })
          }

          return {
            meetingId: meeting.id,
            projectId: matched?.id ?? null,
            projectName: projectStatus.projectName,
            status: projectStatus.status,
            summary: projectStatus.summary,
          }
        })
      )

      projectStatusesCreated = await this.projectStatusRepo.createMany(statusData)
    }

    // Persist todos
    await this.todoRepo.deleteByMeetingId(meeting.id)
    const todosData = agentResponse.todos.map((todo) => ({
      meetingId: meeting.id,
      projectId: this.matchTodoToProject(todo, resolvedProjects),
      title: todo.title,
      description: todo.description,
      assigneeHint: todo.assigneeHint,
      confidence: todo.confidence,
      priority: todo.priority,
      dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
    }))
    const todosCreated = await this.todoRepo.createMany(todosData)
    console.log(`[Processor] Created ${todosCreated} todos`)

    // Persist meeting minutes per language
    await this.minutesRepo.deleteByMeetingId(meeting.id)
    let minutesCreated = 0
    for (const [language, content] of Object.entries(agentResponse.meetingMinutes)) {
      await this.minutesRepo.upsert(meeting.id, language, content)
      minutesCreated++
    }

    // Sync todos to the configured ticket provider (skip NoneTicketProvider)
    let ticketsSynced = 0
    let ticketsFailed = 0

    if (this.ticketProvider.type !== 'none') {
      const todos = await this.todoRepo.findByMeetingId(meeting.id)
      for (const todo of todos) {
        try {
          const result = await this.ticketProvider.createTicket({
            title: todo.title,
            description: todo.description,
            assigneeHint: todo.assigneeHint,
            priority: todo.priority as 'high' | 'medium' | 'low',
            dueDate: todo.dueDate,
            meetingTitle: title,
          })
          await this.ticketSyncRepo.markSynced(todo.id, result)
          ticketsSynced++
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          await this.ticketSyncRepo.markFailed(todo.id, this.ticketProvider.type, msg)
          ticketsFailed++
          console.error(`[Processor] Ticket sync failed for "${todo.title}": ${msg}`)
        }
      }
      console.log(`[Processor] Ticket sync: ${ticketsSynced} synced, ${ticketsFailed} failed`)
    }

    return {
      meeting,
      agentResponse,
      todosCreated,
      minutesCreated,
      projectStatusesCreated,
      ticketsSynced,
      ticketsFailed,
    }
  }

  async reprocessMeeting(
    meetingDbId: string,
    indexingMeta?: {
      indexedForUserId?: string | null
      indexedForUserEmail?: string | null
      indexedByUserId?: string | null
      indexedByUserEmail?: string | null
    }
  ): Promise<ProcessingResult> {
    const meeting = await this.meetingRepo.findById(meetingDbId)
    if (!meeting) throw new Error(`Meeting ${meetingDbId} not found`)
    if (!meeting.transcript) throw new Error(`Meeting ${meetingDbId} has no transcript`)

    const participants = meeting.participants ? JSON.parse(meeting.participants) : []

    return this.processMeeting(
      meeting.meetingId,
      meeting.title,
      meeting.organizer,
      meeting.organizerEmail ?? undefined,
      meeting.startTime,
      meeting.endTime,
      meeting.transcript,
      participants,
      meeting.tenantId ?? undefined,
      undefined,
      {
        indexedForUserId: indexingMeta?.indexedForUserId ?? meeting.indexedForUserId,
        indexedForUserEmail: indexingMeta?.indexedForUserEmail ?? meeting.indexedForUserEmail,
        indexedByUserId: indexingMeta?.indexedByUserId ?? null,
        indexedByUserEmail: indexingMeta?.indexedByUserEmail ?? null,
        isRecrawl: true,
      }
    )
  }
}
