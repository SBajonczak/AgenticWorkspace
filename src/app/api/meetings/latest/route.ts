import { NextResponse } from 'next/server'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { requireAuth } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { session, error } = await requireAuth()
    if (error) return error

    const tenantId = session.user.tenantId
    const userEmail = session.user.email.toLowerCase()

    const meetingRepo = new MeetingRepository()
    const meetings = await meetingRepo.findLatestProcessed(1, tenantId, userEmail)
    const meeting = meetings[0] ?? null

    if (!meeting) {
      return NextResponse.json(null, { status: 404 })
    }

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Failed to fetch latest meeting:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meeting' },
      { status: 500 }
    )
  }
}
