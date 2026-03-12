import { LLMClient, AgentResponse } from '../ai/llmClient'
import { MeetingRepository } from '../db/repositories/meetingRepository'
import { TodoRepository } from '../db/repositories/todoRepository'
import { MeetingMinutesRepository } from '../db/repositories/meetingMinutesRepository'
import { ProjectStatusRepository } from '../db/repositories/projectStatusRepository'
import { Meeting } from '@prisma/client'

export interface ProcessingResult {
  meeting: Meeting
  agentResponse: AgentResponse
  todosCreated: number
  minutesCreated: number
  projectStatusesCreated: number
}

export class MeetingProcessor {
  constructor(
    private llmClient: LLMClient,
    private meetingRepo: MeetingRepository,
    private todoRepo: TodoRepository,
    private minutesRepo: MeetingMinutesRepository,
    private projectStatusRepo: ProjectStatusRepository
  ) {}

  async processMeeting(
    meetingId: string,
    title: string,
    organizer: string,
    organizerEmail: string | undefined,
    startTime: Date,
    endTime: Date,
    transcript: string,
    participants: string[] = []
  ): Promise<ProcessingResult> {
    // Check if meeting already exists
    let meeting = await this.meetingRepo.findByMeetingId(meetingId)

    if (!meeting) {
      // Create new meeting record
      meeting = await this.meetingRepo.create({
        meetingId,
        title,
        organizer,
        organizerEmail,
        startTime,
        endTime,
        transcript,
        participants: JSON.stringify(participants),
      })
    } else {
      // Update participants if meeting exists
      meeting = await this.meetingRepo.update(meeting.id, {
        participants: JSON.stringify(participants),
      })
    }

    // Process with LLM
    console.log(`Processing meeting: ${title}`)
    const agentResponse = await this.llmClient.processTranscript(
      { title, organizer, startTime, endTime },
      transcript
    )

    // Update meeting with summary and decisions
    meeting = await this.meetingRepo.update(meeting.id, {
      summary: agentResponse.meetingSummary.summary,
      decisions: JSON.stringify(agentResponse.meetingSummary.decisions),
      processedAt: new Date(),
    })

    // Create todos (with priority + dueDate)
    const todosData = agentResponse.todos.map((todo) => ({
      meetingId: meeting!.id,
      title: todo.title,
      description: todo.description,
      assigneeHint: todo.assigneeHint,
      confidence: todo.confidence,
      priority: todo.priority,
      dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
    }))
    const todosCreated = await this.todoRepo.createMany(todosData)
    console.log(`Created ${todosCreated} todos`)

    // Store meeting minutes (per language)
    let minutesCreated = 0
    for (const [language, content] of Object.entries(agentResponse.meetingMinutes)) {
      await this.minutesRepo.upsert(meeting.id, language, content)
      minutesCreated++
    }
    console.log(`Created/updated ${minutesCreated} meeting minutes language(s)`)

    // Store project statuses (delete old, insert new)
    await this.projectStatusRepo.deleteByMeetingId(meeting.id)
    let projectStatusesCreated = 0
    if (agentResponse.projectStatuses.length > 0) {
      projectStatusesCreated = await this.projectStatusRepo.createMany(
        agentResponse.projectStatuses.map((ps) => ({
          meetingId: meeting!.id,
          projectName: ps.projectName,
          status: ps.status,
          summary: ps.summary,
        }))
      )
    }
    console.log(`Created ${projectStatusesCreated} project status entries`)

    return {
      meeting,
      agentResponse,
      todosCreated,
      minutesCreated,
      projectStatusesCreated,
    }
  }

  async reprocessMeeting(meetingId: string): Promise<ProcessingResult> {
    const meeting = await this.meetingRepo.findByMeetingId(meetingId)

    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`)
    }

    if (!meeting.transcript) {
      throw new Error(`Meeting ${meetingId} has no transcript`)
    }

    const participants = meeting.participants ? JSON.parse(meeting.participants) : []

    return this.processMeeting(
      meeting.meetingId,
      meeting.title,
      meeting.organizer,
      meeting.organizerEmail || undefined,
      meeting.startTime,
      meeting.endTime,
      meeting.transcript,
      participants
    )
  }
}
