export type MeetingStatus = 'completed' | 'upcoming' | 'cancelled'

export interface MeetingListTodo {
  id: string
}

export interface MeetingListItem {
  id: string
  meetingId: string
  title: string
  organizer: string
  organizerEmail: string | null
  startTime: string
  endTime: string
  summary: string | null
  processedAt: string | null
  status: MeetingStatus
  todos: MeetingListTodo[]
}

export interface MeetingsListResponse {
  meetings: MeetingListItem[]
  meta: {
    kind: 'all' | 'completed' | 'upcoming'
    limit: number
    provider: string
  }
}

export type MeetingsApiResponse = MeetingListItem[] | MeetingsListResponse
