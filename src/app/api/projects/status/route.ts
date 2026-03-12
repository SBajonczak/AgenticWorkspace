import { NextResponse } from 'next/server'
import { ProjectStatusRepository } from '@/db/repositories/projectStatusRepository'
import { requireAuth } from '@/lib/authz'

export async function GET(request: Request) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get('meetingId')

    const projectStatusRepo = new ProjectStatusRepository()

    if (meetingId) {
      // Return statuses for a specific meeting
      const statuses = await projectStatusRepo.findByMeetingId(meetingId)
      return NextResponse.json({ meetingId, statuses })
    }

    // Return latest status per project (across all meetings)
    const statuses = await projectStatusRepo.findLatestPerProject()
    return NextResponse.json({ statuses })
  } catch (error) {
    console.error('Failed to fetch project statuses:', error)
    return NextResponse.json({ error: 'Failed to fetch project statuses' }, { status: 500 })
  }
}
