'use client'

import { useTranslations } from 'next-intl'
import { User, DailyAgentStats } from '@/mocks'

interface GreetingSummaryProps {
  user: User
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
  const firstName = user.name.split(' ')[0]

  return (
    <div className="space-y-3">
      {/* Greeting */}
      <h2 className="text-3xl font-bold text-white">
        {greeting}, {firstName}
      </h2>
      
      {/* Agent Summary */}
      <p className="text-gray-400 text-base leading-relaxed max-w-2xl">
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
