export interface Todo {
  id: string;
  title: string;
  description: string;
  assigneeHint: string | null;
  confidence: number;
  status: 'open' | 'in_progress' | 'done';
  jiraSync: {
    id: string;
    jiraIssueKey: string | null;
    status: 'synced' | 'pending' | 'failed';
    syncedAt: string | null;
  } | null;
}

export interface Meeting {
  id: string;
  meetingId: string;
  title: string;
  organizer: string;
  startTime: string;
  endTime: string;
  transcript: string;
  summary: string;
  decisions: string; // JSON string of string array
  processedAt: string;
  status: 'completed' | 'upcoming' | 'cancelled';
  todos: Todo[];
}

export const mockMeetings: Meeting[] = [
  {
    id: 'meeting-1',
    meetingId: 'teams-meeting-001',
    title: 'Q1 Product Strategy Review',
    organizer: 'Sarah Chen',
    startTime: '2026-01-20T14:00:00Z',
    endTime: '2026-01-20T15:30:00Z',
    status: 'completed',
    transcript: `Sarah Chen: Good afternoon everyone. Let's start with our Q1 product strategy review.

John Miller: Thanks Sarah. I want to discuss our mobile app performance issues that customers have been reporting.

Sarah Chen: Absolutely, that's a priority. Let's add it to our sprint planning.

Emily Rodriguez: I suggest we also review our API rate limits. We've had some scaling issues.

John Miller: Good point. I'll schedule a deep dive session next week.

Sarah Chen: Perfect. Also, we need to finalize our new feature roadmap by end of month.

Emily Rodriguez: I can coordinate with the design team to get mockups ready.

Sarah Chen: Great. Any other concerns? 

John Miller: Yes, we should consider updating our documentation. It's fallen behind.

Sarah Chen: Agreed. Let's make that a priority. I'll assign someone to lead that effort.

Emily Rodriguez: I'm happy to help coordinate that.

Sarah Chen: Excellent. Let's wrap up and I'll send out the meeting notes.`,
    summary: 'Discussed Q1 product strategy priorities including mobile app performance optimization, API scaling improvements, and documentation updates. Team agreed on key action items and timeline for deliverables. Mobile performance issues identified as top priority with customers reporting slowdowns. New feature roadmap needs to be finalized by end of month with design team coordination.',
    decisions: JSON.stringify([
      'Mobile app performance issues will be prioritized in the next sprint',
      'API rate limits review will be scheduled for next week',
      'Documentation updates assigned high priority',
      'New feature roadmap deadline set for end of month'
    ]),
    processedAt: '2026-01-20T15:35:00Z',
    todos: [
      {
        id: 'todo-1',
        title: 'Schedule API rate limits deep dive session',
        description: 'Organize a technical session to review current API rate limits and discuss scaling solutions for reported issues',
        assigneeHint: 'John Miller',
        confidence: 0.92,
        status: 'open',
        jiraSync: {
          id: 'sync-1',
          jiraIssueKey: 'PROD-1234',
          status: 'synced',
          syncedAt: '2026-01-20T15:40:00Z'
        }
      },
      {
        id: 'todo-2',
        title: 'Coordinate design mockups for new features',
        description: 'Work with design team to prepare mockups for upcoming features on the roadmap',
        assigneeHint: 'Emily Rodriguez',
        confidence: 0.88,
        status: 'in_progress',
        jiraSync: {
          id: 'sync-2',
          jiraIssueKey: 'PROD-1235',
          status: 'synced',
          syncedAt: '2026-01-20T15:40:00Z'
        }
      },
      {
        id: 'todo-3',
        title: 'Assign lead for documentation update project',
        description: 'Identify and assign a team lead to oversee the documentation update initiative',
        assigneeHint: 'Sarah Chen',
        confidence: 0.85,
        status: 'open',
        jiraSync: null
      },
      {
        id: 'todo-4',
        title: 'Add mobile performance issues to sprint planning',
        description: 'Prioritize and include mobile app performance optimization in next sprint backlog',
        assigneeHint: null,
        confidence: 0.90,
        status: 'open',
        jiraSync: {
          id: 'sync-4',
          jiraIssueKey: 'PROD-1236',
          status: 'synced',
          syncedAt: '2026-01-20T15:40:00Z'
        }
      }
    ]
  },
  {
    id: 'meeting-2',
    meetingId: 'teams-meeting-002',
    title: 'Customer Feedback Analysis',
    organizer: 'Michael Zhang',
    startTime: '2026-01-22T10:00:00Z',
    endTime: '2026-01-22T11:00:00Z',
    status: 'completed',
    transcript: `Michael Zhang: Good morning team. Today we'll analyze recent customer feedback trends.

Lisa Anderson: We've received over 200 responses this month. Overall satisfaction is at 85%.

Michael Zhang: That's good, but we can do better. What are the main pain points?

Lisa Anderson: The top three are: onboarding complexity, slow support response times, and feature requests for bulk operations.

Tom Williams: The onboarding issue comes up repeatedly. We should streamline that process.

Michael Zhang: Agreed. Lisa, can you draft a proposal for onboarding improvements?

Lisa Anderson: Absolutely, I'll have it ready by Friday.

Tom Williams: For support response times, I suggest we look into adding chatbot capabilities.

Michael Zhang: Good idea. Let's evaluate some solutions and present options next meeting.

Lisa Anderson: I'll research that as well.

Michael Zhang: Perfect. Let's reconvene next week with concrete proposals.`,
    summary: 'Analyzed customer feedback showing 85% satisfaction with key improvement areas identified. Main pain points include complex onboarding process, slow support response times, and missing bulk operation features. Team committed to developing proposals for onboarding improvements and exploring chatbot integration for support.',
    decisions: JSON.stringify([
      'Onboarding process needs streamlining based on customer feedback',
      'Chatbot capabilities to be evaluated for support response improvement',
      'Proposals to be presented in follow-up meeting next week'
    ]),
    processedAt: '2026-01-22T11:05:00Z',
    todos: [
      {
        id: 'todo-5',
        title: 'Draft onboarding improvement proposal',
        description: 'Create a detailed proposal for streamlining the customer onboarding process based on feedback analysis',
        assigneeHint: 'Lisa Anderson',
        confidence: 0.95,
        status: 'in_progress',
        jiraSync: {
          id: 'sync-5',
          jiraIssueKey: 'PROD-1237',
          status: 'synced',
          syncedAt: '2026-01-22T11:10:00Z'
        }
      },
      {
        id: 'todo-6',
        title: 'Research chatbot solutions for customer support',
        description: 'Evaluate available chatbot platforms and prepare comparison for improving support response times',
        assigneeHint: 'Lisa Anderson',
        confidence: 0.87,
        status: 'open',
        jiraSync: {
          id: 'sync-6',
          jiraIssueKey: 'PROD-1238',
          status: 'synced',
          syncedAt: '2026-01-22T11:10:00Z'
        }
      }
    ]
  },
  {
    id: 'meeting-3',
    meetingId: 'teams-meeting-003',
    title: 'Security Audit Follow-up',
    organizer: 'David Kim',
    startTime: '2026-01-23T15:00:00Z',
    endTime: '2026-01-23T16:00:00Z',
    status: 'completed',
    transcript: `David Kim: Let's review the findings from last week's security audit.

Jennifer Lee: We identified 12 medium-priority vulnerabilities and 3 high-priority ones.

David Kim: The high-priority items need immediate attention. What are they?

Jennifer Lee: SQL injection risk in the legacy admin panel, outdated SSL certificates on two servers, and insufficient access logging.

Robert Brown: I can handle the SSL certificates this week.

David Kim: Good. Jennifer, can you lead the SQL injection fix?

Jennifer Lee: Yes, I'll coordinate with the backend team.

David Kim: What about the access logging?

Robert Brown: I'll implement enhanced logging across all services.

David Kim: Perfect. Let's aim to have all high-priority items resolved by end of week.

Jennifer Lee: Understood. I'll send daily progress updates.`,
    summary: 'Reviewed security audit findings with 12 medium and 3 high-priority vulnerabilities identified. High-priority issues include SQL injection risk in legacy admin panel, outdated SSL certificates, and insufficient access logging. Team assigned responsibilities with target completion by end of week.',
    decisions: JSON.stringify([
      'All high-priority security vulnerabilities must be resolved by end of week',
      'Daily progress updates to be provided on remediation efforts',
      'Backend team to coordinate on SQL injection fix'
    ]),
    processedAt: '2026-01-23T16:05:00Z',
    todos: [
      {
        id: 'todo-7',
        title: 'Update SSL certificates on two servers',
        description: 'Replace outdated SSL certificates identified in security audit on production servers',
        assigneeHint: 'Robert Brown',
        confidence: 0.93,
        status: 'done',
        jiraSync: {
          id: 'sync-7',
          jiraIssueKey: 'SEC-445',
          status: 'synced',
          syncedAt: '2026-01-23T16:10:00Z'
        }
      },
      {
        id: 'todo-8',
        title: 'Fix SQL injection vulnerability in admin panel',
        description: 'Coordinate with backend team to patch SQL injection risk in legacy admin panel',
        assigneeHint: 'Jennifer Lee',
        confidence: 0.96,
        status: 'in_progress',
        jiraSync: {
          id: 'sync-8',
          jiraIssueKey: 'SEC-446',
          status: 'synced',
          syncedAt: '2026-01-23T16:10:00Z'
        }
      },
      {
        id: 'todo-9',
        title: 'Implement enhanced access logging',
        description: 'Deploy comprehensive access logging across all services to meet security requirements',
        assigneeHint: 'Robert Brown',
        confidence: 0.89,
        status: 'open',
        jiraSync: {
          id: 'sync-9',
          jiraIssueKey: 'SEC-447',
          status: 'synced',
          syncedAt: '2026-01-23T16:10:00Z'
        }
      }
    ]
  },
  {
    id: 'meeting-4',
    meetingId: 'teams-meeting-004',
    title: 'Marketing Campaign Planning',
    organizer: 'Amanda Foster',
    startTime: '2026-01-27T13:00:00Z',
    endTime: '2026-01-27T14:00:00Z',
    status: 'upcoming',
    transcript: '',
    summary: '',
    decisions: JSON.stringify([]),
    processedAt: '',
    todos: []
  },
  {
    id: 'meeting-5',
    meetingId: 'teams-meeting-005',
    title: 'Engineering All-Hands',
    organizer: 'Sarah Chen',
    startTime: '2026-01-28T16:00:00Z',
    endTime: '2026-01-28T17:00:00Z',
    status: 'upcoming',
    transcript: '',
    summary: '',
    decisions: JSON.stringify([]),
    processedAt: '',
    todos: []
  }
];

export const getMeetingById = (id: string): Meeting | undefined => {
  return mockMeetings.find(m => m.id === id);
};

export const getRecentMeetings = (limit: number = 3): Meeting[] => {
  return mockMeetings
    .filter(m => m.status === 'completed')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, limit);
};

export const getUpcomingMeetings = (limit: number = 5): Meeting[] => {
  return mockMeetings
    .filter(m => m.status === 'upcoming')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, limit);
};
