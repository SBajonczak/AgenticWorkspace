import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'

const LOOKAHEAD_DEFAULT_DAYS = 14
const LOOKAHEAD_MIN_DAYS = 1
const LOOKAHEAD_MAX_DAYS = 31
const SUMMARY_WINDOW_DEFAULT_DAYS = 7
const SUMMARY_WINDOW_MIN_DAYS = 1
const SUMMARY_WINDOW_MAX_DAYS = 90

const UpdateUserSettingsSchema = z.object({
  meetingLookaheadDays: z.number().int().min(LOOKAHEAD_MIN_DAYS).max(LOOKAHEAD_MAX_DAYS),
  summaryWindowDays: z.number().int().min(SUMMARY_WINDOW_MIN_DAYS).max(SUMMARY_WINDOW_MAX_DAYS),
})

function resolveUserId(session: Session | null): string | null {
  const user = session?.user as { id?: string } | undefined
  return user?.id ?? null
}

function readMeetingLookaheadDays(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  return (value as { meetingLookaheadDays?: unknown }).meetingLookaheadDays
}

function readSummaryWindowDays(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  return (value as { summaryWindowDays?: unknown }).summaryWindowDays
}

function clampLookaheadDays(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return LOOKAHEAD_DEFAULT_DAYS
  const normalized = Math.trunc(parsed)
  return Math.max(LOOKAHEAD_MIN_DAYS, Math.min(LOOKAHEAD_MAX_DAYS, normalized))
}

function clampSummaryWindowDays(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return SUMMARY_WINDOW_DEFAULT_DAYS
  const normalized = Math.trunc(parsed)
  return Math.max(SUMMARY_WINDOW_MIN_DAYS, Math.min(SUMMARY_WINDOW_MAX_DAYS, normalized))
}

export async function GET() {
  const session = await auth()
  const userId = resolveUserId(session)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncRepo = new UserSyncStateRepository()
  const syncState = await syncRepo.getByUserId(userId)
  const meetingLookaheadDays = clampLookaheadDays(readMeetingLookaheadDays(syncState))
  const summaryWindowDays = clampSummaryWindowDays(readSummaryWindowDays(syncState))

  return NextResponse.json({ meetingLookaheadDays, summaryWindowDays })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  const userId = resolveUserId(session)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateUserSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const meetingLookaheadDays = clampLookaheadDays(parsed.data.meetingLookaheadDays)
  const summaryWindowDays = clampSummaryWindowDays(parsed.data.summaryWindowDays)
  const syncRepo = new UserSyncStateRepository()
  const updated = await syncRepo.upsert(userId, { meetingLookaheadDays, summaryWindowDays })

  return NextResponse.json({
    meetingLookaheadDays: clampLookaheadDays(readMeetingLookaheadDays(updated)),
    summaryWindowDays: clampSummaryWindowDays(readSummaryWindowDays(updated)),
  })
}
