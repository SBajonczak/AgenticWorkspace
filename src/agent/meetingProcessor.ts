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

  constructor(
    private llmClient: LLMClient,
    private meetingRepo: MeetingRepository,
    private todoRepo: TodoRepository,
    private minutesRepo: MeetingMinutesRepository,
    private projectStatusRepo: ProjectStatusRepository,
    private ticketSyncRepo: TicketSyncRepository = new TicketSyncRepository(),
    private ticketProvider: ITicketProvider = new NoneTicketProvider()
  ) {
    this.projectRepo = new ProjectRepository()
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
    tenantId?: string
  ): Promise<ProcessingResult> {
    // Upsert meeting record
    const existingMeeting = await this.meetingRepo.findByMeetingId(meetingId)
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
        ...(tenantId ? { tenant: { connect: { id: tenantId } } } : {}),
      })
    } else {
      meeting = await this.meetingRepo.update(existingMeeting.id, {
        participants: JSON.stringify(participants),
      })
    }

    // LLM analysis
    console.log(`[Processor] Analysing meeting: ${title}`)
    const agentResponse = await this.llmClient.processTranscript(
      { title, organizer, startTime, endTime },
      transcript
    )

    // Persist summary + decisions
    meeting = await this.meetingRepo.update(meeting.id, {
      summary: agentResponse.meetingSummary.summary,
      decisions: JSON.stringify(agentResponse.meetingSummary.decisions),
      processedAt: new Date(),
    })

    // Persist todos
    const todosData = agentResponse.todos.map((todo) => ({
      meetingId: meeting.id,
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
    let minutesCreated = 0
    for (const [language, content] of Object.entries(agentResponse.meetingMinutes)) {
      await this.minutesRepo.upsert(meeting.id, language, content)
      minutesCreated++
    }

    // Persist project statuses – match against managed projects by name/alias
    await this.projectStatusRepo.deleteByMeetingId(meeting.id)
    let projectStatusesCreated = 0
    if (agentResponse.projectStatuses.length > 0) {
      const statusData = await Promise.all(
        agentResponse.projectStatuses.map(async (ps) => {
          const matched = await this.projectRepo.findByNameOrAlias(ps.projectName, tenantId)
          return {
            meetingId: meeting.id,
            projectId: matched?.id ?? null,
            projectName: ps.projectName,
            status: ps.status,
            summary: ps.summary,
          }
        })
      )
      projectStatusesCreated = await this.projectStatusRepo.createMany(statusData)
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

  async reprocessMeeting(meetingId: string): Promise<ProcessingResult> {
    const meeting = await this.meetingRepo.findByMeetingId(meetingId)
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`)
    if (!meeting.transcript) throw new Error(`Meeting ${meetingId} has no transcript`)

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
      meeting.tenantId ?? undefined
    )
  }
}
