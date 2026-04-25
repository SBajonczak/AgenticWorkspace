'use client'

import { useTranslations } from 'next-intl'
import { DashboardSummaryResponse } from '@/types/meetings'
import { DashboardUserProfile } from '@/types/user'

interface GreetingSummaryProps {
  user: DashboardUserProfile
  summary: DashboardSummaryResponse
}

function formatMeetingDate(value: string): string {
  return new Date(value).toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function GreetingSummary({ user, summary }: GreetingSummaryProps) {
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

      <div className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">
          {t('summarySection.title')}
        </p>

        <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl">
          {t('summarySection.description', {
            windowDays: summary.windowDays,
            meetingCount: summary.meetingsConductedCount,
            assignedTaskCount: summary.assignedTaskCount,
          })}
        </p>

        {summary.meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('summarySection.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {summary.meetings.map((meeting) => (
              <li key={meeting.id} className="rounded-md border border-border/60 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground">{formatMeetingDate(meeting.startTime)}</p>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {meeting.summary || t('summarySection.noMeetingSummary')}
                </p>
                {meeting.assignedTaskCount > 0 ? (
                  <p className="text-xs text-foreground mt-1">
                    {t('summarySection.assignedTasks', { count: meeting.assignedTaskCount })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
