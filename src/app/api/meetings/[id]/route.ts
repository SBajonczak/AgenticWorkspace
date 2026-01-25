import { NextResponse } from 'next/server'
import { MeetingRepository } from '@/db/repositories/meetingRepository'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const meetingRepo = new MeetingRepository()
    const meeting = await meetingRepo.findById(params.id)

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(meeting)
  } catch (error) {
    console.error('Failed to fetch meeting:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meeting' },
      { status: 500 }
    )
  }
}
