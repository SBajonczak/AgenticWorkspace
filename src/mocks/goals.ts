export interface MarketSignal {
  id: string;
  type: 'competitor' | 'trend' | 'regulation' | 'technology';
  title: string;
  description: string;
  source: string;
  date: string;
  impact: 'high' | 'medium' | 'low';
  relevantGoals: string[];
}

export interface CompanyGoal {
  id: string;
  title: string;
  description: string;
  category: 'revenue' | 'product' | 'customer' | 'operational';
  targetDate: string;
  progress: number;
  owner: string;
  metrics: {
    label: string;
    current: number;
    target: number;
    unit: string;
  }[];
  relatedProjectIds: string[];
  agentRecommendation: string;
}

export const mockGoals: CompanyGoal[] = [
  {
    id: 'goal-1',
    title: 'Achieve 95% Customer Satisfaction Score',
    description: 'Improve overall customer satisfaction through better onboarding, faster support, and enhanced product quality.',
    category: 'customer',
    targetDate: '2026-03-31T00:00:00Z',
    progress: 89,
    owner: 'Michael Zhang',
    metrics: [
      { label: 'Current CSAT', current: 85, target: 95, unit: '%' },
      { label: 'Support Response Time', current: 4.2, target: 2, unit: 'hours' },
      { label: 'Onboarding Completion', current: 72, target: 90, unit: '%' }
    ],
    relatedProjectIds: ['project-2', 'project-6'],
    agentRecommendation: 'Onboarding redesign and chatbot implementation are critical to achieving this goal. Current trajectory shows we\'ll reach 92% by Q1 end without additional interventions.'
  },
  {
    id: 'goal-2',
    title: 'Reduce Infrastructure Costs by 25%',
    description: 'Optimize cloud infrastructure, implement efficient scaling, and reduce resource waste.',
    category: 'operational',
    targetDate: '2026-06-30T00:00:00Z',
    progress: 40,
    owner: 'David Kim',
    metrics: [
      { label: 'Current Monthly Cost', current: 45000, target: 33750, unit: '$' },
      { label: 'CPU Utilization', current: 45, target: 70, unit: '%' },
      { label: 'Storage Optimization', current: 35, target: 50, unit: '%' }
    ],
    relatedProjectIds: ['project-4', 'project-3'],
    agentRecommendation: 'API scaling improvements will enable better resource utilization. Consider implementing auto-scaling policies and reserved instances for predictable workloads.'
  },
  {
    id: 'goal-3',
    title: 'Launch 3 Major Product Features',
    description: 'Deliver three customer-requested features: bulk operations, advanced analytics, and mobile offline mode.',
    category: 'product',
    targetDate: '2026-06-30T00:00:00Z',
    progress: 25,
    owner: 'Sarah Chen',
    metrics: [
      { label: 'Features Completed', current: 0, target: 3, unit: 'features' },
      { label: 'Feature Development Progress', current: 25, target: 100, unit: '%' },
      { label: 'Beta User Signups', current: 127, target: 500, unit: 'users' }
    ],
    relatedProjectIds: ['project-1', 'project-5'],
    agentRecommendation: 'Mobile performance optimization is prerequisite for offline mode feature. Recommend prioritizing bulk operations feature first as it has highest customer demand and lowest technical complexity.'
  },
  {
    id: 'goal-4',
    title: 'Increase Developer Adoption by 50%',
    description: 'Grow developer user base through improved documentation, SDK support, and community engagement.',
    category: 'revenue',
    targetDate: '2026-09-30T00:00:00Z',
    progress: 30,
    owner: 'Emily Rodriguez',
    metrics: [
      { label: 'Active Developers', current: 2600, target: 3900, unit: 'devs' },
      { label: 'API Calls per Month', current: 12000000, target: 18000000, unit: 'calls' },
      { label: 'SDK Downloads', current: 850, target: 1500, unit: 'downloads/month' }
    ],
    relatedProjectIds: ['project-5', 'project-4'],
    agentRecommendation: 'Documentation portal v2 launch is critical milestone. Early feedback is positive. Consider hosting developer workshops and creating video tutorials to accelerate adoption.'
  },
  {
    id: 'goal-5',
    title: 'Achieve SOC 2 Type II Compliance',
    description: 'Complete all security and compliance requirements for SOC 2 Type II certification.',
    category: 'operational',
    targetDate: '2026-08-31T00:00:00Z',
    progress: 65,
    owner: 'David Kim',
    metrics: [
      { label: 'Control Implementation', current: 65, target: 100, unit: '%' },
      { label: 'Audit Readiness', current: 70, target: 100, unit: '%' },
      { label: 'Security Training Completion', current: 88, target: 100, unit: '%' }
    ],
    relatedProjectIds: ['project-3'],
    agentRecommendation: 'Security infrastructure upgrades are on schedule. Critical vulnerabilities are being addressed. Schedule external audit for Q2 to validate compliance posture.'
  }
];

export const mockMarketSignals: MarketSignal[] = [
  {
    id: 'signal-1',
    type: 'competitor',
    title: 'Major Competitor Launches AI-Powered Analytics',
    description: 'TechCorp released AI-driven analytics features with real-time insights and predictive modeling capabilities.',
    source: 'Industry Report',
    date: '2026-01-20T00:00:00Z',
    impact: 'high',
    relevantGoals: ['goal-3']
  },
  {
    id: 'signal-2',
    type: 'trend',
    title: 'Enterprise Demand for Mobile-First Solutions Grows 35%',
    description: 'Latest survey shows enterprises prioritizing mobile-optimized platforms. 68% plan to increase mobile app investments.',
    source: 'Market Research',
    date: '2026-01-18T00:00:00Z',
    impact: 'high',
    relevantGoals: ['goal-3', 'goal-4']
  },
  {
    id: 'signal-3',
    type: 'regulation',
    title: 'New Data Privacy Regulations in EU',
    description: 'European Union announces stricter data handling requirements effective July 2026.',
    source: 'Regulatory Update',
    date: '2026-01-22T00:00:00Z',
    impact: 'medium',
    relevantGoals: ['goal-5']
  },
  {
    id: 'signal-4',
    type: 'technology',
    title: 'Developer Community Embraces New SDK Standards',
    description: 'Industry moving toward unified SDK interfaces. Early adopters seeing 40% faster integration times.',
    source: 'Developer Survey',
    date: '2026-01-19T00:00:00Z',
    impact: 'medium',
    relevantGoals: ['goal-4']
  },
  {
    id: 'signal-5',
    type: 'competitor',
    title: 'DataFlow Reduces Pricing by 20%',
    description: 'Key competitor announced significant price reductions to gain market share in SMB segment.',
    source: 'Press Release',
    date: '2026-01-23T00:00:00Z',
    impact: 'high',
    relevantGoals: ['goal-2', 'goal-4']
  },
  {
    id: 'signal-6',
    type: 'trend',
    title: 'Customer Support Automation Adoption Surges',
    description: 'B2B companies reporting 45% reduction in support costs through chatbot implementation.',
    source: 'Industry Analysis',
    date: '2026-01-21T00:00:00Z',
    impact: 'medium',
    relevantGoals: ['goal-1', 'goal-2']
  }
];

export const getGoalById = (id: string): CompanyGoal | undefined => {
  return mockGoals.find(g => g.id === id);
};

export const getGoalsByCategory = (category: CompanyGoal['category']): CompanyGoal[] => {
  return mockGoals.filter(g => g.category === category);
};

export const getSignalsByImpact = (impact: MarketSignal['impact']): MarketSignal[] => {
  return mockMarketSignals.filter(s => s.impact === impact);
};

export const getSignalsForGoal = (goalId: string): MarketSignal[] => {
  return mockMarketSignals.filter(s => s.relevantGoals.includes(goalId));
};
