import { NextResponse } from 'next/server'
import { MeetingMinutesRepository } from '@/db/repositories/meetingMinutesRepository'
import { requireMeetingParticipant } from '@/lib/authz'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await requireMeetingParticipant(params.id)
    if (error) return error

    const minutesRepo = new MeetingMinutesRepository()
    const minutes = await minutesRepo.findByMeetingId(params.id)

    if (minutes.length === 0) {
      return NextResponse.json(
        { error: 'No meeting minutes found for this meeting' },
        { status: 404 }
      )
    }

    // Return as a map: { de: "...", en: "..." }
    const minutesMap: Record<string, string> = {}
    for (const m of minutes) {
      minutesMap[m.language] = m.content
    }

    return NextResponse.json({
      meetingId: params.id,
      languages: minutes.map((m) => m.language),
      minutes: minutesMap,
    })
  } catch (error) {
    console.error('Failed to fetch meeting minutes:', error)
    return NextResponse.json({ error: 'Failed to fetch meeting minutes' }, { status: 500 })
  }
}
