export interface User {
  id: string;
  name: string;
  role: string;
  location: string;
  initials: string;
  avatarUrl?: string;
}

export interface Weather {
  city: string;
  temperature: number;
  condition: string;
  unit: 'C' | 'F';
}

export interface DailyAgentStats {
  meetingsProcessedYesterday: number;
  actionItemsIdentifiedYesterday: number;
  upcomingMeetingsToday: number;
}

export const mockUser: User = {
  id: 'user-1',
  name: 'David Kim',
  role: 'Product Manager',
  location: 'Berlin',
  initials: 'DK',
};

export const mockWeather: Weather = {
  city: 'Berlin',
  temperature: 6,
  condition: 'cloudy',
  unit: 'C',
};

export const mockDailyStats: DailyAgentStats = {
  meetingsProcessedYesterday: 2,
  actionItemsIdentifiedYesterday: 5,
  upcomingMeetingsToday: 2,
};
