export type MeetingStatus = 'completed' | 'upcoming' | 'cancelled' | 'processing'
export type MeetingIndexingStatus = 'not_indexed' | 'indexed' | 'processing'

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
  isIndexing: boolean
  hasTranscript: boolean
  indexingStatus: MeetingIndexingStatus
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

export interface MeetingPreparationAgendaItem {
  title: string
  rationale: string
  priority: 'high' | 'medium' | 'low'
  source: 'history' | 'knowledge_base' | 'conflict'
}

export interface MeetingPreparationConflict {
  id: string
  title: string
  startTime: string
  endTime: string
}

export interface MeetingPreparationRelatedMeeting {
  id: string
  title: string
  startTime: string
  summary: string | null
  decisions: string[]
  openTodos: {
    id: string
    title: string
    assigneeHint: string | null
    status: string
  }[]
  projectStatuses: {
    projectName: string
    status: string
    summary: string
  }[]
}

export interface MeetingPreparationResponse {
  upcomingMeeting: {
    id: string
    title: string
    organizer: string
    startTime: string
    endTime: string
  }
  relatedMeetings: MeetingPreparationRelatedMeeting[]
  preparedAgenda: MeetingPreparationAgendaItem[]
  knowledgeBaseItems: {
    title: string
    excerpt: string
    url?: string
    decisions?: string[]
    openTodos?: {
      id: string
      title: string
      assigneeHint: string | null
      priority: string | null
    }[]
  }[]
  conflicts: MeetingPreparationConflict[]
  cadence: {
    isRecurring: boolean
    type: 'daily' | 'jourfix' | 'recurring' | 'other'
    label: string
  }
  prepStatus: {
    level: 'ready' | 'attention' | 'in_progress'
    reasons: string[]
  }
  carryOverTopics: {
    title: string
    occurrences: number
    lastSeenAt: string
  }[]
  longRunningTasks: {
    title: string
    occurrences: number
    ageDays: number
    firstSeenAt: string
  }[]
  projectSourceResults: {
    projectName: string
    sourceType: 'confluence' | 'jira' | 'github' | 'sharepoint'
    sourceLabel: string
    identifier: string
    query: string
    score: number
    items: {
      title: string
      excerpt: string
      url: string
      updatedAt?: string
      score: number
      matchedTerms: string[]
      matchScore: number
      freshnessScore: number
    }[]
  }[]
}
