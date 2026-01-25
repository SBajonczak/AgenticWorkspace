import { NextResponse } from 'next/server'
import { MeetingRepository } from '@/db/repositories/meetingRepository'

export async function GET() {
  try {
    const meetingRepo = new MeetingRepository()
    const meeting = await meetingRepo.getLatestProcessed()

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
