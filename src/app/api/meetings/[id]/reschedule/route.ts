import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { UserTokenService } from '@/graph/userTokenService'
import { MeetingsClient } from '@/graph/meetings'
import { requireMeetingParticipant } from '@/lib/authz'
import { MeetingRescheduleResponse } from '@/types/meetings'
import { prisma } from '@/db/prisma'

const RescheduleSchema = z.object({
  targetStartTime: z.string().datetime(),
  targetEndTime: z.string().datetime(),
})

function hasCalendarWriteScope(scopeValue: string | null | undefined): boolean {
  if (!scopeValue) return false
  return scopeValue.split(/\s+/).includes('Calendars.ReadWrite')
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireMeetingParticipant(params.id)
    if (error) return error

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = RescheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const startTime = new Date(parsed.data.targetStartTime)
    const endTime = new Date(parsed.data.targetEndTime)

    if (startTime.getTime() >= endTime.getTime()) {
      return NextResponse.json({ error: 'Start time must be before end time.' }, { status: 422 })
    }

    const meetingRepo = new MeetingRepository()
    const meeting = await meetingRepo.findById(params.id)
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'microsoft-entra-id',
      },
      select: { scope: true },
    })

    if (!hasCalendarWriteScope(account?.scope)) {
      return NextResponse.json(
        { error: 'Missing Calendars.ReadWrite scope. Please sign in again with calendar write consent.' },
        { status: 403 }
      )
    }

    const tokenService = new UserTokenService()
    const accessToken = await tokenService.getValidAccessTokenForUser(session.user.id)
    const meetingsClient = new MeetingsClient(accessToken, session.user.email)

    const eventId = await meetingsClient.findEventIdForMeetingWindow({
      title: meeting.title,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
    })

    if (!eventId) {
      return NextResponse.json({ error: 'Calendar event could not be resolved for this meeting.' }, { status: 404 })
    }

    await meetingsClient.rescheduleEventById({
      eventId,
      startTime,
      endTime,
    })

    await meetingRepo.update(meeting.id, {
      startTime,
      endTime,
    })

    const payload: MeetingRescheduleResponse = {
      success: true,
      meetingId: meeting.id,
      updatedStartTime: startTime.toISOString(),
      updatedEndTime: endTime.toISOString(),
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Failed to reschedule meeting:', error)
    return NextResponse.json({ error: 'Failed to reschedule meeting' }, { status: 500 })
  }
}
