'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { MeetingListItem, MeetingPreparationResponse } from '@/types/meetings'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Calendar, ChevronDown, ChevronUp, Sparkles, User } from 'lucide-react'

function getPrepStatusBadgeClass(level: MeetingPreparationResponse['prepStatus']['level']): string {
  if (level === 'ready') {
    return 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
  }
  if (level === 'attention') {
    return 'border-amber-500/50 text-amber-600 dark:text-amber-400'
  }
  return 'border-blue-500/50 text-blue-600 dark:text-blue-400'
}

interface UpcomingMeetingsWidgetProps {
  meetings: MeetingListItem[]
  lastUpdatedAt: string | null
}

export default function UpcomingMeetingsWidget({ meetings, lastUpdatedAt }: UpcomingMeetingsWidgetProps) {
  const t = useTranslations('widgets.upcomingMeetings')
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({})
  const [preparationById, setPreparationById] = useState<Record<string, MeetingPreparationResponse>>({})
  const [loadingById, setLoadingById] = useState<Record<string, boolean>>({})
  const [errorById, setErrorById] = useState<Record<string, string | null>>({})

  const visibleMeetings = meetings.slice(0, 3)

  const conflictMap = useMemo(() => {
    const map: Record<string, MeetingListItem[]> = {}

    for (const meeting of visibleMeetings) {
      map[meeting.id] = []
    }

    for (let index = 0; index < visibleMeetings.length; index++) {
      const current = visibleMeetings[index]
      const currentStart = new Date(current.startTime)
      const currentEnd = new Date(current.endTime)

      for (let compareIndex = 0; compareIndex < visibleMeetings.length; compareIndex++) {
        if (index === compareIndex) continue
        const candidate = visibleMeetings[compareIndex]
        const candidateStart = new Date(candidate.startTime)
        const candidateEnd = new Date(candidate.endTime)

        const hasOverlap = currentStart.getTime() < candidateEnd.getTime() && candidateStart.getTime() < currentEnd.getTime()
        if (hasOverlap) {
          map[current.id].push(candidate)
        }
      }
    }

    return map
  }, [visibleMeetings])

  const lastUpdatedLabel = lastUpdatedAt
    ? t('updatedAt', {
        time: new Date(lastUpdatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
    : null

  async function loadPreparation(meetingId: string) {
    try {
      setLoadingById((prev) => ({ ...prev, [meetingId]: true }))
      setErrorById((prev) => ({ ...prev, [meetingId]: null }))

      const response = await fetch(`/api/meetings/${meetingId}/preparation`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }

      const data = (await response.json()) as MeetingPreparationResponse
      setPreparationById((prev) => ({ ...prev, [meetingId]: data }))
    } catch {
      setErrorById((prev) => ({ ...prev, [meetingId]: t('preparationError') }))
    } finally {
      setLoadingById((prev) => ({ ...prev, [meetingId]: false }))
    }
  }

  function togglePreparation(meetingId: string) {
    const nextExpanded = !Boolean(expandedById[meetingId])

    setExpandedById((prev) => ({
      ...prev,
      [meetingId]: nextExpanded,
    }))

    if (nextExpanded && !preparationById[meetingId] && !loadingById[meetingId]) {
      void loadPreparation(meetingId)
    }
  }

  const getTimeUntil = (startTime: string): string => {
    const start = new Date(startTime)
    const now = new Date()
    const diff = start.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days === 0) return t('today')
    if (days === 1) return t('tomorrow')
    return `${t('in')} ${days}d`
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card className="bg-card border-border hover:shadow-md transition-all rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-1">{t('title')}</h3>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
              {lastUpdatedLabel && (
                <p className="text-[11px] text-muted-foreground mt-1">{lastUpdatedLabel}</p>
              )}
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {meetings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noMeetings')}</p>
          ) : (
            <div className="space-y-3">
              {visibleMeetings.map((meeting) => {
                const conflicts = conflictMap[meeting.id] || []
                const hasConflicts = conflicts.length > 0
                const isExpanded = Boolean(expandedById[meeting.id])
                const preparation = preparationById[meeting.id]
                const isLoading = Boolean(loadingById[meeting.id])
                const preparationError = errorById[meeting.id]
                const prepStatusLevel = preparation?.prepStatus.level
                const prepStatusText = prepStatusLevel ? t(`prepStatus.${prepStatusLevel}`) : null

                return (
                <div
                  key={meeting.id}
                  className={`bg-muted/40 rounded-lg p-4 ${hasConflicts ? 'border border-amber-500/40' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-foreground font-semibold mb-1">{meeting.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{meeting.organizer}</span>
                        <span>•</span>
                        <span>{new Date(meeting.startTime).toLocaleDateString()}</span>
                      </div>
                      {hasConflicts && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3" />
                          {t('conflictWith', { title: conflicts[0].title })}
                        </p>
                      )}
                    </div>
                    <div className="ml-2 flex flex-col items-end gap-1.5 shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {getTimeUntil(meeting.startTime)}
                      </Badge>
                      {prepStatusLevel && prepStatusText && (
                        <Badge variant="outline" className={`text-[11px] ${getPrepStatusBadgeClass(prepStatusLevel)}`}>
                          {prepStatusText}
                        </Badge>
                      )}
                      {hasConflicts && (
                        <Badge variant="outline" className="text-[11px] border-amber-500/50 text-amber-600 dark:text-amber-400">
                          {t('conflict')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => togglePreparation(meeting.id)}
                    className="mt-3 w-full text-left text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center justify-between"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      {isExpanded ? t('hidePreparation') : t('prepare')}
                    </span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 rounded-md bg-background/60 border border-border p-3 space-y-2">
                      {isLoading && (
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-5/6" />
                          <Skeleton className="h-3 w-4/6" />
                        </div>
                      )}

                      {!isLoading && preparationError && (
                        <p className="text-xs text-destructive">{preparationError}</p>
                      )}

                      {!isLoading && !preparationError && preparation && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {t('prepSummary', {
                              carryOver: preparation.carryOverTopics.length,
                              longRunning: preparation.longRunningTasks.length,
                            })}
                          </p>

                          {preparation.prepStatus.reasons.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {preparation.prepStatus.reasons[0]}
                            </p>
                          )}

                          <p className="text-xs font-semibold text-foreground">{t('agendaPreviewTitle')}</p>
                          {preparation.preparedAgenda.length > 0 ? (
                            <ul className="space-y-1">
                              {preparation.preparedAgenda.slice(0, 2).map((item, index) => (
                                <li key={`${meeting.id}-agenda-${index}`} className="text-xs text-muted-foreground">
                                  • {item.title}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">{t('noAgenda')}</p>
                          )}

                          <Link
                            href={`/meetings/${meeting.id}/preparation`}
                            className="inline-flex text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                          >
                            {t('viewFullPreparation')} →
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Link
            href="/schedule"
            className="w-full text-center text-primary hover:text-primary/80 transition-colors text-sm font-semibold"
          >
            {t('viewSchedule')} →
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
