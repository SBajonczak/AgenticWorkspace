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
const DEFAULT_TIMEZONE = 'Europe/Berlin'
const DEFAULT_WORK_DAY_START = '09:00'
const DEFAULT_WORK_DAY_END = '17:00'

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

const FocusTimeSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(TIME_PATTERN),
  endTime: z.string().regex(TIME_PATTERN),
})

const UpdateUserSettingsSchema = z.object({
  meetingLookaheadDays: z.number().int().min(LOOKAHEAD_MIN_DAYS).max(LOOKAHEAD_MAX_DAYS),
  summaryWindowDays: z.number().int().min(SUMMARY_WINDOW_MIN_DAYS).max(SUMMARY_WINDOW_MAX_DAYS),
  timezone: z.string().trim().min(1).max(120).optional(),
  workDayStart: z.string().regex(TIME_PATTERN).optional(),
  workDayEnd: z.string().regex(TIME_PATTERN).optional(),
  focusTimeSlots: z.array(FocusTimeSlotSchema).max(30).optional(),
}).superRefine((value, ctx) => {
  const workDayStart = value.workDayStart ?? DEFAULT_WORK_DAY_START
  const workDayEnd = value.workDayEnd ?? DEFAULT_WORK_DAY_END
  const slots = value.focusTimeSlots ?? []

  const workStartMinutes = toMinutes(workDayStart)
  const workEndMinutes = toMinutes(workDayEnd)

  if (workStartMinutes >= workEndMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workDayStart'],
      message: 'Working day start must be before end.',
    })
  }

  for (const slot of slots) {
    const slotStart = toMinutes(slot.startTime)
    const slotEnd = toMinutes(slot.endTime)

    if (slotStart >= slotEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['focusTimeSlots'],
        message: 'Focus slot start must be before end.',
      })
      continue
    }

    if (slotStart < workStartMinutes || slotEnd > workEndMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['focusTimeSlots'],
        message: 'Focus slots must stay within working hours.',
      })
    }
  }

  const grouped = new Map<number, Array<{ start: number; end: number }>>()
  for (const slot of slots) {
    const list = grouped.get(slot.dayOfWeek) ?? []
    list.push({ start: toMinutes(slot.startTime), end: toMinutes(slot.endTime) })
    grouped.set(slot.dayOfWeek, list)
  }

  for (const daySlots of grouped.values()) {
    daySlots.sort((a, b) => a.start - b.start)
    for (let index = 1; index < daySlots.length; index += 1) {
      if (daySlots[index].start < daySlots[index - 1].end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['focusTimeSlots'],
          message: 'Focus slots overlap.',
        })
      }
    }
  }
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

function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return TIME_PATTERN.test(trimmed) ? trimmed : fallback
}

function normalizeTimezone(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_TIMEZONE
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_TIMEZONE
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part))
  return hours * 60 + minutes
}

function normalizeFocusSlots(value: unknown): Array<{ id?: string; dayOfWeek: number; startTime: string; endTime: string }> {
  if (!Array.isArray(value)) return []
  const normalized = value
    .map((slot) => {
      if (typeof slot !== 'object' || slot === null) return null
      const item = slot as { id?: unknown; dayOfWeek?: unknown; startTime?: unknown; endTime?: unknown }
      const dayOfWeek = Number(item.dayOfWeek)
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null
      const startTime = normalizeTime(item.startTime, DEFAULT_WORK_DAY_START)
      const endTime = normalizeTime(item.endTime, DEFAULT_WORK_DAY_END)
      if (toMinutes(startTime) >= toMinutes(endTime)) return null

      return {
        id: typeof item.id === 'string' ? item.id : null,
        dayOfWeek,
        startTime,
        endTime,
      }
    })
    .filter((slot): slot is { id: string | null; dayOfWeek: number; startTime: string; endTime: string } => Boolean(slot))

  return normalized.map((slot) => ({
    id: slot.id ?? undefined,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }))
}

function toResponsePayload(value: unknown) {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  return {
    meetingLookaheadDays: clampLookaheadDays(readMeetingLookaheadDays(value)),
    summaryWindowDays: clampSummaryWindowDays(readSummaryWindowDays(value)),
    timezone: normalizeTimezone(record.timezone),
    workDayStart: normalizeTime(record.workDayStart, DEFAULT_WORK_DAY_START),
    workDayEnd: normalizeTime(record.workDayEnd, DEFAULT_WORK_DAY_END),
    focusTimeSlots: normalizeFocusSlots(record.focusTimeSlots),
  }
}

export async function GET() {
  const session = await auth()
  const userId = resolveUserId(session)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncRepo = new UserSyncStateRepository()
  const syncState = await syncRepo.getByUserId(userId)
  return NextResponse.json(toResponsePayload(syncState))
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
  const timezone = normalizeTimezone(parsed.data.timezone)
  const workDayStart = normalizeTime(parsed.data.workDayStart, DEFAULT_WORK_DAY_START)
  const workDayEnd = normalizeTime(parsed.data.workDayEnd, DEFAULT_WORK_DAY_END)
  const focusTimeSlots = (parsed.data.focusTimeSlots ?? []).map((slot) => ({
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }))
  const syncRepo = new UserSyncStateRepository()
  const updated = await syncRepo.upsertSchedulePreferences(userId, {
    meetingLookaheadDays,
    summaryWindowDays,
    timezone,
    workDayStart,
    workDayEnd,
    focusTimeSlots,
  })

  return NextResponse.json(toResponsePayload(updated))
}
