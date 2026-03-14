'use client'

import { useTranslations } from 'next-intl'
import { DailyAgentStats } from '@/mocks'
import { DashboardUserProfile } from '@/types/user'

interface GreetingSummaryProps {
  user: DashboardUserProfile
  stats: DailyAgentStats
}

export default function GreetingSummary({ user, stats }: GreetingSummaryProps) {
  const t = useTranslations('common')
  
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours()
    
    if (hour >= 5 && hour < 12) {
      return t('greeting.morning')
    } else if (hour >= 12 && hour < 18) {
      return t('greeting.day')
    } else {
      return t('greeting.evening')
    }
  }

  const greeting = getTimeBasedGreeting()
  const displayName = user.name?.trim()

  return (
    <div className="space-y-3">
      <h2 className="text-3xl font-bold text-foreground">
        {displayName ? `${greeting}, ${displayName}` : greeting}
      </h2>
      <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
        {t('agentSummary.yesterday', {
          meetingCount: stats.meetingsProcessedYesterday,
          actionCount: stats.actionItemsIdentifiedYesterday
        })}{' '}
        {t('agentSummary.today', {
          upcomingCount: stats.upcomingMeetingsToday
        })}
      </p>
    </div>
  )
}
