'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ClipboardList, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import AppHeader from '@/components/layout/AppHeader'
import { Link } from '@/i18n/routing'
import { DashboardSummaryResponse } from '@/types/meetings'

const DEFAULT_DASHBOARD_SUMMARY: DashboardSummaryResponse = {
  windowDays: 7,
  from: new Date(0).toISOString(),
  to: new Date(0).toISOString(),
  meetingsConductedCount: 0,
  assignedTaskCount: 0,
  meetings: [],
}

function formatBriefingRange(from: string, to: string): string {
  const fromDate = new Date(from)
  const toDate = new Date(to)

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return ''
  }

  return `${fromDate.toLocaleDateString([], { day: '2-digit', month: 'short' })} - ${toDate.toLocaleDateString([], { day: '2-digit', month: 'short' })}`
}

function formatMeetingDate(value: string): string {
  return new Date(value).toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function BriefingPage() {
  const t = useTranslations('common')
  const [summary, setSummary] = useState<DashboardSummaryResponse>(DEFAULT_DASHBOARD_SUMMARY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadSummary = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/dashboard/summary', { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load summary')
        const data = (await response.json()) as DashboardSummaryResponse
        if (active) setSummary(data)
      } catch {
        if (active) setSummary(DEFAULT_DASHBOARD_SUMMARY)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSummary()

    return () => {
      active = false
    }
  }, [])

  const briefingRange = useMemo(() => formatBriefingRange(summary.from, summary.to), [summary.from, summary.to])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="dashboard" />

      <main className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('summarySection.briefingPageEyebrow')}</p>
                <h1 className="mt-1 text-2xl font-semibold text-foreground">{t('summarySection.briefingPageTitle')}</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                  {t('summarySection.description', {
                    windowDays: summary.windowDays,
                    meetingCount: summary.meetingsConductedCount,
                    assignedTaskCount: summary.assignedTaskCount,
                  })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {briefingRange ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {briefingRange}
                  </span>
                ) : null}
                <Link
                  href="/dashboard"
                  className="inline-flex items-center rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  {t('summarySection.backToDashboard')}
                </Link>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              {t('labels.loading')}
            </div>
          ) : summary.meetings.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              {t('summarySection.empty')}
            </div>
          ) : (
            <section className="space-y-3">
              {summary.meetings.map((meeting) => (
                <details key={meeting.id} className="group rounded-xl border border-border/70 bg-background px-4 py-3 open:shadow-sm">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                        <p className="text-xs text-muted-foreground">{formatMeetingDate(meeting.startTime)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {meeting.assignedTaskCount > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {t('summarySection.assignedTasks', { count: meeting.assignedTaskCount })}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                          {t('summarySection.expandHint')}
                        </span>
                      </div>
                    </div>
                  </summary>

                  <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {meeting.summary || t('summarySection.noMeetingSummary')}
                    </p>

                    <div className="flex justify-end">
                      <Link
                        href={`/meetings/${meeting.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:opacity-80"
                      >
                        {t('summarySection.more')}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </details>
              ))}
            </section>
          )}

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start gap-2">
              <ClipboardList className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t('summarySection.briefingHint')}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
