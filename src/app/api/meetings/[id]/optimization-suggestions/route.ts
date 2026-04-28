import { NextResponse } from 'next/server'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { requireMeetingParticipant } from '@/lib/authz'
import { MeetingOptimizationResponse, MeetingOptimizationSuggestion } from '@/types/meetings'

const DEFAULT_WORK_DAY_START = '09:00'
const DEFAULT_WORK_DAY_END = '17:00'
const DEFAULT_SLOT_MINUTES = 30
const BUFFER_MINUTES = 15
const SUGGESTION_LIMIT = 3

type FocusSlot = {
  dayOfWeek: number
  startTime: string
  endTime: string
}

type CandidateSlot = {
  startTime: Date
  endTime: Date
  score: number
  reason: string
  respectsFocusTime: boolean
  withinWorkHours: boolean
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part))
  return hours * 60 + minutes
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60 * 1000)
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function buildDateAtTime(baseDate: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map((part) => Number(part))
  const value = new Date(baseDate)
  value.setHours(hours, minutes, 0, 0)
  return value
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

function getDurationMinutes(startTime: Date, endTime: Date): number {
  return Math.max(DEFAULT_SLOT_MINUTES, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
}

function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6
}

function scoreSlot(input: {
  slotStart: Date
  workStart: Date
  focusConflict: boolean
  neighborMeetings: Array<{ title: string }>
  sourceMeetingTitle: string
}): { score: number; reason: string } {
  let score = 100
  const reasons: string[] = []

  if (input.focusConflict) {
    score -= 50
    reasons.push('overlaps configured focus time')
  } else {
    reasons.push('respects focus time')
  }

  const minutesFromWorkStart = Math.round((input.slotStart.getTime() - input.workStart.getTime()) / 60000)
  if (minutesFromWorkStart >= 60 && minutesFromWorkStart <= 240) {
    score += 8
    reasons.push('in productive morning block')
  }

  const similarNeighbors = input.neighborMeetings.filter((meeting) => {
    const candidateWords = meeting.title.toLowerCase().split(/\s+/).filter((word) => word.length > 3)
    return candidateWords.some((word) => input.sourceMeetingTitle.toLowerCase().includes(word))
  })

  if (similarNeighbors.length > 0) {
    score += 10
    reasons.push('reduces context switching')
  }

  if (reasons.length === 0) {
    reasons.push('fits available working slot')
  }

  return {
    score,
    reason: reasons.join(', '),
  }
}

function resolveFocusSlots(value: unknown): FocusSlot[] {
  if (!Array.isArray(value)) return []
  return value
    .map((slot) => {
      if (typeof slot !== 'object' || slot === null) return null
      const entry = slot as { dayOfWeek?: unknown; startTime?: unknown; endTime?: unknown }
      const dayOfWeek = Number(entry.dayOfWeek)
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null
      if (typeof entry.startTime !== 'string' || typeof entry.endTime !== 'string') return null
      return {
        dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
      }
    })
    .filter((slot): slot is FocusSlot => Boolean(slot))
}

function findCandidateSlots(input: {
  sourceMeeting: { startTime: Date; endTime: Date; title: string }
  nearbyMeetings: Array<{ id: string; title: string; startTime: Date; endTime: Date }>
  focusSlots: FocusSlot[]
  workDayStart: string
  workDayEnd: string
}): CandidateSlot[] {
  const durationMinutes = getDurationMinutes(input.sourceMeeting.startTime, input.sourceMeeting.endTime)
  const slots: CandidateSlot[] = []
  const now = new Date()

  for (let dayOffset = 0; dayOffset <= 10; dayOffset += 1) {
    const day = startOfDay(addMinutes(now, dayOffset * 24 * 60))
    const dayOfWeek = day.getDay()
    if (isWeekend(dayOfWeek)) continue

    const workStart = buildDateAtTime(day, input.workDayStart)
    const workEnd = buildDateAtTime(day, input.workDayEnd)
    if (workStart.getTime() >= workEnd.getTime()) continue

    let slotStart = new Date(workStart)
    while (slotStart.getTime() + durationMinutes * 60000 <= workEnd.getTime()) {
      const slotEnd = addMinutes(slotStart, durationMinutes)
      const bufferedStart = addMinutes(slotStart, -BUFFER_MINUTES)
      const bufferedEnd = addMinutes(slotEnd, BUFFER_MINUTES)

      const hasMeetingConflict = input.nearbyMeetings.some((meeting) =>
        overlaps(bufferedStart, bufferedEnd, meeting.startTime, meeting.endTime)
      )

      if (!hasMeetingConflict) {
        const focusConflict = input.focusSlots
          .filter((slot) => slot.dayOfWeek === dayOfWeek)
          .some((slot) => {
            const focusStart = buildDateAtTime(day, slot.startTime)
            const focusEnd = buildDateAtTime(day, slot.endTime)
            return overlaps(slotStart, slotEnd, focusStart, focusEnd)
          })

        const nearestMeetings = input.nearbyMeetings.filter((meeting) => {
          const distanceMinutes = Math.abs(meeting.startTime.getTime() - slotStart.getTime()) / 60000
          return distanceMinutes <= 180
        })

        const scored = scoreSlot({
          slotStart,
          workStart,
          focusConflict,
          neighborMeetings: nearestMeetings,
          sourceMeetingTitle: input.sourceMeeting.title,
        })

        slots.push({
          startTime: slotStart,
          endTime: slotEnd,
          score: scored.score,
          reason: scored.reason,
          respectsFocusTime: !focusConflict,
          withinWorkHours: true,
        })
      }

      slotStart = addMinutes(slotStart, 30)
    }
  }

  return slots
    .filter((slot) => slot.startTime.getTime() > Date.now())
    .sort((a, b) => b.score - a.score)
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireMeetingParticipant(params.id)
    if (error) return error

    const meetingRepo = new MeetingRepository()
    const sourceMeeting = await meetingRepo.findById(params.id)

    if (!sourceMeeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const userId = session.user.id
    const tenantId = (session.user as { tenantId?: string }).tenantId
    const userEmail = session.user.email.toLowerCase()

    const syncRepo = new UserSyncStateRepository()
    const userSettings = await syncRepo.getByUserId(userId)

    const workDayStart = typeof userSettings?.workDayStart === 'string' ? userSettings.workDayStart : DEFAULT_WORK_DAY_START
    const workDayEnd = typeof userSettings?.workDayEnd === 'string' ? userSettings.workDayEnd : DEFAULT_WORK_DAY_END
    const focusSlots = resolveFocusSlots(userSettings?.focusTimeSlots)

    const upcomingMeetings = await meetingRepo.findUpcoming(120, new Date(), tenantId, userEmail)
    const nearbyMeetings = upcomingMeetings
      .filter((meeting) => meeting.id !== sourceMeeting.id)
      .map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
      }))

    const suggestions = findCandidateSlots({
      sourceMeeting: {
        startTime: sourceMeeting.startTime,
        endTime: sourceMeeting.endTime,
        title: sourceMeeting.title,
      },
      nearbyMeetings,
      focusSlots,
      workDayStart,
      workDayEnd,
    })
      .filter((slot) => slot.startTime.getTime() !== sourceMeeting.startTime.getTime())
      .slice(0, SUGGESTION_LIMIT)
      .map((slot, index): MeetingOptimizationSuggestion => ({
        id: `${params.id}-${index + 1}`,
        targetStartTime: slot.startTime.toISOString(),
        targetEndTime: slot.endTime.toISOString(),
        score: slot.score,
        reason: slot.reason,
        respectsFocusTime: slot.respectsFocusTime,
        withinWorkHours: slot.withinWorkHours,
      }))

    const payload: MeetingOptimizationResponse = {
      meetingId: params.id,
      generatedAt: new Date().toISOString(),
      suggestions,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Failed to generate optimization suggestions:', error)
    return NextResponse.json({ error: 'Failed to generate optimization suggestions' }, { status: 500 })
  }
}
