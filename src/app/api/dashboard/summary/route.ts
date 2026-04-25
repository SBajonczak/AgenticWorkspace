import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { prisma } from '@/db/prisma'
import { DashboardSummaryResponse } from '@/types/meetings'

const SUMMARY_WINDOW_DEFAULT_DAYS = 7
const SUMMARY_WINDOW_MIN_DAYS = 1
const SUMMARY_WINDOW_MAX_DAYS = 90

function clampSummaryWindowDays(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return SUMMARY_WINDOW_DEFAULT_DAYS
  const normalized = Math.trunc(parsed)
  return Math.max(SUMMARY_WINDOW_MIN_DAYS, Math.min(SUMMARY_WINDOW_MAX_DAYS, normalized))
}

function trimToTwoSentences(value: string | null): string | null {
  const text = value?.trim()
  if (!text) return null

  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 2) return parts.join(' ')
  return `${parts.slice(0, 2).join(' ')}`
}

function readSummaryWindowDays(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  return (value as { summaryWindowDays?: unknown }).summaryWindowDays
}

function buildDateWindow(days: number): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)

  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - (days - 1))

  return { from, to }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const userEmail = session.user.email?.toLowerCase()
  let tenantId = (session.user as { tenantId?: string }).tenantId

  if (!tenantId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    })
    tenantId = user?.tenantId ?? undefined
  }

  const syncRepo = new UserSyncStateRepository()
  const syncState = await syncRepo.getByUserId(userId)
  const windowDays = clampSummaryWindowDays(readSummaryWindowDays(syncState))
  const { from, to } = buildDateWindow(windowDays)

  const meetingRepo = new MeetingRepository()
  const meetings = await meetingRepo.findProcessedInWindow({
    from,
    to,
    tenantId,
    userEmail,
    limit: 200,
  })

  const normalizedMeetings = meetings.map((meeting) => {
    const assignedTaskCount = meeting.todos.filter((todo) => todo.assigneeUserId === userId).length

    return {
      id: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime.toISOString(),
      summary: trimToTwoSentences(meeting.summary),
      assignedTaskCount,
    }
  })

  const payload: DashboardSummaryResponse = {
    windowDays,
    from: from.toISOString(),
    to: to.toISOString(),
    meetingsConductedCount: normalizedMeetings.length,
    assignedTaskCount: normalizedMeetings.reduce((sum, meeting) => sum + meeting.assignedTaskCount, 0),
    meetings: normalizedMeetings,
  }

  return NextResponse.json(payload)
}
