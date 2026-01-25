export interface ProjectUpdate {
  id: string;
  date: string;
  author: string;
  content: string;
  type: 'progress' | 'blocker' | 'milestone';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  aiSummary: string;
  status: 'active' | 'on_hold' | 'completed';
  startDate: string;
  targetDate: string;
  completionPercentage: number;
  owner: string;
  team: string[];
  openActions: number;
  relatedMeetingIds: string[];
  updates: ProjectUpdate[];
  tags: string[];
}

export const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Mobile App Performance Optimization',
    description: 'Comprehensive performance improvement initiative for iOS and Android applications focusing on load times, responsiveness, and battery efficiency.',
    aiSummary: 'Critical performance initiative addressing customer complaints about slow load times. Team is implementing lazy loading, optimizing image assets, and refactoring data fetching logic. Expected 40% improvement in app launch time.',
    status: 'active',
    startDate: '2026-01-15T00:00:00Z',
    targetDate: '2026-03-15T00:00:00Z',
    completionPercentage: 35,
    owner: 'John Miller',
    team: ['John Miller', 'Sarah Chen', 'Tom Williams', 'Lisa Anderson'],
    openActions: 8,
    relatedMeetingIds: ['meeting-1'],
    tags: ['mobile', 'performance', 'critical'],
    updates: [
      {
        id: 'update-1',
        date: '2026-01-24T10:00:00Z',
        author: 'John Miller',
        content: 'Completed initial profiling. Identified image loading as primary bottleneck. Moving to implementation phase.',
        type: 'progress'
      },
      {
        id: 'update-2',
        date: '2026-01-20T14:30:00Z',
        author: 'Sarah Chen',
        content: 'Sprint planning completed. Performance optimization is now top priority.',
        type: 'milestone'
      },
      {
        id: 'update-3',
        date: '2026-01-18T09:00:00Z',
        author: 'Tom Williams',
        content: 'Dependency conflict with new lazy loading library. Investigating alternatives.',
        type: 'blocker'
      }
    ]
  },
  {
    id: 'project-2',
    name: 'Customer Onboarding Redesign',
    description: 'Complete redesign of the customer onboarding experience to reduce complexity and improve conversion rates.',
    aiSummary: 'Strategic initiative to address customer feedback about complex onboarding. Design team creating simplified 3-step flow. Early prototypes showing 60% reduction in onboarding time and improved user satisfaction scores.',
    status: 'active',
    startDate: '2026-01-22T00:00:00Z',
    targetDate: '2026-02-28T00:00:00Z',
    completionPercentage: 25,
    owner: 'Lisa Anderson',
    team: ['Lisa Anderson', 'Emily Rodriguez', 'Michael Zhang'],
    openActions: 5,
    relatedMeetingIds: ['meeting-2'],
    tags: ['ux', 'customer-experience', 'high-priority'],
    updates: [
      {
        id: 'update-4',
        date: '2026-01-24T15:00:00Z',
        author: 'Emily Rodriguez',
        content: 'Design mockups completed and approved by stakeholders. Ready for development.',
        type: 'milestone'
      },
      {
        id: 'update-5',
        date: '2026-01-23T11:30:00Z',
        author: 'Lisa Anderson',
        content: 'User research completed with 50 participants. Clear preference for simplified flow.',
        type: 'progress'
      }
    ]
  },
  {
    id: 'project-3',
    name: 'Security Infrastructure Upgrade',
    description: 'Comprehensive security audit remediation and infrastructure hardening initiative.',
    aiSummary: 'High-priority security project addressing audit findings. Team resolving critical vulnerabilities, updating certificates, and implementing enhanced monitoring. All high-priority items on track for completion this week.',
    status: 'active',
    startDate: '2026-01-16T00:00:00Z',
    targetDate: '2026-02-15T00:00:00Z',
    completionPercentage: 60,
    owner: 'David Kim',
    team: ['David Kim', 'Jennifer Lee', 'Robert Brown'],
    openActions: 4,
    relatedMeetingIds: ['meeting-3'],
    tags: ['security', 'infrastructure', 'critical'],
    updates: [
      {
        id: 'update-6',
        date: '2026-01-24T16:00:00Z',
        author: 'Robert Brown',
        content: 'SSL certificates updated successfully. All servers now using latest security protocols.',
        type: 'milestone'
      },
      {
        id: 'update-7',
        date: '2026-01-23T18:00:00Z',
        author: 'Jennifer Lee',
        content: 'SQL injection fix in code review. Should merge by tomorrow.',
        type: 'progress'
      },
      {
        id: 'update-8',
        date: '2026-01-23T10:00:00Z',
        author: 'David Kim',
        content: 'Penetration testing scheduled for next week to validate fixes.',
        type: 'progress'
      }
    ]
  },
  {
    id: 'project-4',
    name: 'API Scaling & Rate Limiting',
    description: 'Infrastructure improvements to handle increased API traffic and implement intelligent rate limiting.',
    aiSummary: 'Technical project addressing scaling concerns. Team implementing Redis-based rate limiting and horizontal scaling. Load testing shows 3x capacity improvement. Deep dive session scheduled for detailed technical review.',
    status: 'active',
    startDate: '2026-01-10T00:00:00Z',
    targetDate: '2026-02-10T00:00:00Z',
    completionPercentage: 45,
    owner: 'Emily Rodriguez',
    team: ['Emily Rodriguez', 'John Miller', 'Tom Williams'],
    openActions: 6,
    relatedMeetingIds: ['meeting-1'],
    tags: ['backend', 'infrastructure', 'performance'],
    updates: [
      {
        id: 'update-9',
        date: '2026-01-23T14:00:00Z',
        author: 'Emily Rodriguez',
        content: 'Redis cluster deployed to staging. Initial tests showing excellent performance.',
        type: 'progress'
      },
      {
        id: 'update-10',
        date: '2026-01-21T10:00:00Z',
        author: 'Tom Williams',
        content: 'Load balancer configuration completed. Ready for production deployment.',
        type: 'milestone'
      }
    ]
  },
  {
    id: 'project-5',
    name: 'Documentation Portal v2',
    description: 'Complete overhaul of developer and customer documentation with improved search and navigation.',
    aiSummary: 'Documentation modernization project with new portal platform. Focus on improved search, interactive examples, and better organization. Early access feedback extremely positive from beta users.',
    status: 'active',
    startDate: '2026-01-05T00:00:00Z',
    targetDate: '2026-03-01T00:00:00Z',
    completionPercentage: 55,
    owner: 'Emily Rodriguez',
    team: ['Emily Rodriguez', 'Sarah Chen', 'Michael Zhang'],
    openActions: 7,
    relatedMeetingIds: ['meeting-1'],
    tags: ['documentation', 'developer-experience'],
    updates: [
      {
        id: 'update-11',
        date: '2026-01-24T11:00:00Z',
        author: 'Emily Rodriguez',
        content: 'API reference section completed. Now working on getting started guides.',
        type: 'progress'
      },
      {
        id: 'update-12',
        date: '2026-01-20T16:00:00Z',
        author: 'Sarah Chen',
        content: 'New documentation platform deployed to preview environment. Gathering feedback.',
        type: 'milestone'
      }
    ]
  },
  {
    id: 'project-6',
    name: 'Customer Support Chatbot',
    description: 'AI-powered chatbot implementation to improve support response times and handle common inquiries.',
    aiSummary: 'Innovative support automation project. Evaluating leading chatbot platforms with focus on integration ease and customization. Expected to reduce ticket volume by 30% and improve response times significantly.',
    status: 'active',
    startDate: '2026-01-22T00:00:00Z',
    targetDate: '2026-03-30T00:00:00Z',
    completionPercentage: 15,
    owner: 'Lisa Anderson',
    team: ['Lisa Anderson', 'Michael Zhang', 'Tom Williams'],
    openActions: 9,
    relatedMeetingIds: ['meeting-2'],
    tags: ['ai', 'customer-support', 'automation'],
    updates: [
      {
        id: 'update-13',
        date: '2026-01-24T09:00:00Z',
        author: 'Lisa Anderson',
        content: 'Vendor evaluation in progress. Narrowed down to 3 platforms for POC.',
        type: 'progress'
      }
    ]
  }
];

export const getProjectById = (id: string): Project | undefined => {
  return mockProjects.find(p => p.id === id);
};

export const getActiveProjects = (limit?: number): Project[] => {
  const active = mockProjects
    .filter(p => p.status === 'active')
    .sort((a, b) => b.openActions - a.openActions);
  
  return limit ? active.slice(0, limit) : active;
};

export const getProjectsByMeetingId = (meetingId: string): Project[] => {
  return mockProjects.filter(p => p.relatedMeetingIds.includes(meetingId));
};
