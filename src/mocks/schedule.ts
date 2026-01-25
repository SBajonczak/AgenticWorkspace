export interface ScheduleEvent {
  id: string;
  title: string;
  type: 'meeting' | 'deadline' | 'milestone';
  startTime: string;
  endTime?: string;
  organizer?: string;
  attendees?: string[];
  location?: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  relatedProjectId?: string;
  relatedMeetingId?: string;
  agentSuggestion?: string;
}

export const mockScheduleEvents: ScheduleEvent[] = [
  {
    id: 'event-1',
    title: 'Marketing Campaign Planning',
    type: 'meeting',
    startTime: '2026-01-27T13:00:00Z',
    endTime: '2026-01-27T14:00:00Z',
    organizer: 'Amanda Foster',
    attendees: ['Amanda Foster', 'Michael Zhang', 'Lisa Anderson'],
    location: 'Teams Meeting',
    status: 'upcoming',
    relatedMeetingId: 'meeting-4',
    agentSuggestion: 'Prepare Q1 campaign metrics and budget allocation proposal'
  },
  {
    id: 'event-2',
    title: 'Engineering All-Hands',
    type: 'meeting',
    startTime: '2026-01-28T16:00:00Z',
    endTime: '2026-01-28T17:00:00Z',
    organizer: 'Sarah Chen',
    attendees: ['Sarah Chen', 'John Miller', 'Emily Rodriguez', 'David Kim', 'Jennifer Lee', 'Robert Brown', 'Tom Williams'],
    location: 'Teams Meeting',
    status: 'upcoming',
    relatedMeetingId: 'meeting-5',
    agentSuggestion: 'Review security updates and performance optimization progress'
  },
  {
    id: 'event-3',
    title: 'API Deep Dive Session',
    type: 'meeting',
    startTime: '2026-01-29T10:00:00Z',
    endTime: '2026-01-29T11:30:00Z',
    organizer: 'John Miller',
    attendees: ['John Miller', 'Emily Rodriguez', 'Tom Williams'],
    location: 'Conference Room B',
    status: 'upcoming',
    relatedProjectId: 'project-4',
    agentSuggestion: 'Technical review of rate limiting implementation and scaling strategy'
  },
  {
    id: 'event-4',
    title: 'Customer Onboarding Proposal Review',
    type: 'meeting',
    startTime: '2026-01-29T14:00:00Z',
    endTime: '2026-01-29T15:00:00Z',
    organizer: 'Lisa Anderson',
    attendees: ['Lisa Anderson', 'Emily Rodriguez', 'Michael Zhang', 'Amanda Foster'],
    location: 'Teams Meeting',
    status: 'upcoming',
    relatedProjectId: 'project-2',
    agentSuggestion: 'Present finalized onboarding flow proposal with user research insights'
  },
  {
    id: 'event-5',
    title: 'Security Penetration Testing',
    type: 'meeting',
    startTime: '2026-01-30T09:00:00Z',
    endTime: '2026-01-30T12:00:00Z',
    organizer: 'David Kim',
    attendees: ['David Kim', 'Jennifer Lee', 'Robert Brown'],
    location: 'Secure Lab',
    status: 'upcoming',
    relatedProjectId: 'project-3',
    agentSuggestion: 'Validate all security fixes from audit before scheduling'
  },
  {
    id: 'event-6',
    title: 'Mobile App Performance - Sprint Demo',
    type: 'milestone',
    startTime: '2026-01-31T15:00:00Z',
    endTime: '2026-01-31T16:00:00Z',
    organizer: 'John Miller',
    attendees: ['John Miller', 'Sarah Chen', 'Tom Williams', 'Lisa Anderson'],
    location: 'Teams Meeting',
    status: 'upcoming',
    relatedProjectId: 'project-1',
    agentSuggestion: 'Showcase performance improvements and gather stakeholder feedback'
  },
  {
    id: 'event-7',
    title: 'Documentation Portal Beta Release',
    type: 'deadline',
    startTime: '2026-02-03T00:00:00Z',
    status: 'upcoming',
    relatedProjectId: 'project-5',
    agentSuggestion: 'Ensure all API references are complete and tested before launch'
  },
  {
    id: 'event-8',
    title: 'Weekly Product Sync',
    type: 'meeting',
    startTime: '2026-02-03T14:00:00Z',
    endTime: '2026-02-03T15:00:00Z',
    organizer: 'Sarah Chen',
    attendees: ['Sarah Chen', 'John Miller', 'Emily Rodriguez', 'Michael Zhang', 'Amanda Foster'],
    location: 'Teams Meeting',
    status: 'upcoming',
    agentSuggestion: 'Review weekly progress across all active projects'
  },
  {
    id: 'event-9',
    title: 'Chatbot POC Results',
    type: 'meeting',
    startTime: '2026-02-05T11:00:00Z',
    endTime: '2026-02-05T12:00:00Z',
    organizer: 'Lisa Anderson',
    attendees: ['Lisa Anderson', 'Michael Zhang', 'Tom Williams'],
    location: 'Conference Room A',
    status: 'upcoming',
    relatedProjectId: 'project-6',
    agentSuggestion: 'Compare POC results and make vendor selection decision'
  },
  {
    id: 'event-10',
    title: 'Q1 OKR Review Deadline',
    type: 'deadline',
    startTime: '2026-02-07T00:00:00Z',
    status: 'upcoming',
    agentSuggestion: 'All teams should submit Q1 progress reports by this date'
  }
];

export const getUpcomingEvents = (limit?: number): ScheduleEvent[] => {
  const upcoming = mockScheduleEvents
    .filter(e => e.status === 'upcoming')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  
  return limit ? upcoming.slice(0, limit) : upcoming;
};

export const getEventsByDate = (date: string): ScheduleEvent[] => {
  const targetDate = new Date(date).toDateString();
  return mockScheduleEvents.filter(e => 
    new Date(e.startTime).toDateString() === targetDate
  );
};

export const getEventsByProject = (projectId: string): ScheduleEvent[] => {
  return mockScheduleEvents.filter(e => e.relatedProjectId === projectId);
};
