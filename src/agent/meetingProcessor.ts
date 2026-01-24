import { LLMClient, AgentResponse } from '../ai/llmClient'
import { MeetingRepository } from '../db/repositories/meetingRepository'
import { TodoRepository } from '../db/repositories/todoRepository'
import { Meeting } from '@prisma/client'

export interface ProcessingResult {
  meeting: Meeting
  agentResponse: AgentResponse
  todosCreated: number
}

export class MeetingProcessor {
  constructor(
    private llmClient: LLMClient,
    private meetingRepo: MeetingRepository,
    private todoRepo: TodoRepository
  ) {}

  async processMeeting(
    meetingId: string,
    title: string,
    organizer: string,
    organizerEmail: string | undefined,
    startTime: Date,
    endTime: Date,
    transcript: string
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
      })
    }

    // Process with LLM
    console.log(`Processing meeting: ${title}`)
    const agentResponse = await this.llmClient.processTranscript(
      {
        title,
        organizer,
        startTime,
        endTime,
      },
      transcript
    )

    // Update meeting with results
    meeting = await this.meetingRepo.update(meeting.id, {
      summary: agentResponse.meetingSummary.summary,
      decisions: JSON.stringify(agentResponse.meetingSummary.decisions),
      processedAt: new Date(),
    })

    // Create todos
    const todosData = agentResponse.todos.map((todo) => ({
      meetingId: meeting.id,
      title: todo.title,
      description: todo.description,
      assigneeHint: todo.assigneeHint,
      confidence: todo.confidence,
    }))

    const todosCreated = await this.todoRepo.createMany(todosData)
    console.log(`Created ${todosCreated} todos`)

    return {
      meeting,
      agentResponse,
      todosCreated,
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

    return this.processMeeting(
      meeting.meetingId,
      meeting.title,
      meeting.organizer,
      meeting.organizerEmail || undefined,
      meeting.startTime,
      meeting.endTime,
      meeting.transcript
    )
  }
}
