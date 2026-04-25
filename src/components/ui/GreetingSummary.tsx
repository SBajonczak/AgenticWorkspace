'use client'

import { ArrowRight, CalendarDays, Newspaper } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { Link } from '@/i18n/routing'
import { DashboardSummaryResponse } from '@/types/meetings'
import { DashboardUserProfile } from '@/types/user'

interface GreetingSummaryProps {
  user: DashboardUserProfile
  summary: DashboardSummaryResponse
}

function formatBriefingRange(from: string, to: string): string {
  const fromDate = new Date(from)
  const toDate = new Date(to)

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return ''
  }

  return `${fromDate.toLocaleDateString([], { day: '2-digit', month: 'short' })} - ${toDate.toLocaleDateString([], { day: '2-digit', month: 'short' })}`
}

function toSentencePreview(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  const [firstSentence] = text.split(/(?<=[.!?])\s+/)
  return firstSentence?.trim() || null
}

export default function GreetingSummary({ user, summary }: GreetingSummaryProps) {
  const t = useTranslations('common')
  const hasMeetings = summary.meetings.length > 0

  const briefingRange = useMemo(() => formatBriefingRange(summary.from, summary.to), [summary.from, summary.to])

  const briefingHeadline = useMemo(() => {
    if (!hasMeetings) {
      return [t('summarySection.empty')]
    }

    const titles = summary.meetings.slice(0, 3).map((meeting) => meeting.title.trim()).filter(Boolean)
    const remaining = Math.max(0, summary.meetingsConductedCount - titles.length)
    const titleList = new Intl.ListFormat(undefined, { style: 'long', type: 'conjunction' }).format(titles)

    const contentHighlights = summary.meetings
      .map((meeting) => meeting.summary)
      .filter((value): value is string => Boolean(value))
      .map(toSentencePreview)
      .filter((value): value is string => Boolean(value))
      .slice(0, 2)

    const sentences = [
      t('summarySection.briefingMeetingsLine', {
        topics: titleList,
        remaining,
      }),
      contentHighlights.length > 0
        ? t('summarySection.briefingThemesLine', {
          highlights: contentHighlights.join(' '),
        })
        : t('summarySection.noMeetingSummary'),
      t('summarySection.briefingTasksLine', {
        assignedTaskCount: summary.assignedTaskCount,
      }),
    ]

    return sentences.slice(0, 3)
  }, [hasMeetings, summary.assignedTaskCount, summary.meetings, summary.meetingsConductedCount, t])

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

      <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Newspaper className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-foreground">{t('summarySection.briefingTitle')}</p>
              {briefingRange ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {briefingRange}
                </span>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground max-w-3xl">
              {t('summarySection.description', {
                windowDays: summary.windowDays,
                meetingCount: summary.meetingsConductedCount,
                assignedTaskCount: summary.assignedTaskCount,
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-1 text-xs font-medium text-foreground">
              {t('summarySection.meetingsBadge', { count: summary.meetingsConductedCount })}
            </span>
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-1 text-xs font-medium text-foreground">
              {t('summarySection.tasksBadge', { count: summary.assignedTaskCount })}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('summarySection.overviewLabel')}</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">{briefingHeadline.join(' ')}</p>
        </div>

        <div className="mt-3 flex justify-end">
          <Link
            href="/briefing"
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            {hasMeetings ? t('summarySection.goToBriefing') : t('summarySection.goToBriefingEmpty')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
