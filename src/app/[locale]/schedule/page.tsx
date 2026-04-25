'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { MeetingListItem, MeetingPreparationResponse, MeetingsApiResponse } from '@/types/meetings'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Calendar, ChevronDown, ChevronUp, Clock, Loader2, Sparkles, User } from 'lucide-react'

type ScheduleFilter = 'all' | 'meetings'

interface ScheduleMeetingEvent {
  id: string
  title: string
  type: 'meeting'
  startTime: string
  endTime: string
  organizer: string
  agentSuggestion?: string
}

function normalizeMeetingsResponse(data: MeetingsApiResponse): MeetingListItem[] {
  return Array.isArray(data) ? data : data.meetings
}

function toScheduleEvent(meeting: MeetingListItem): ScheduleMeetingEvent {
  return {
    id: meeting.id,
    title: meeting.title,
    type: 'meeting',
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    organizer: meeting.organizer,
    agentSuggestion: meeting.summary ?? undefined,
  }
}

function getCalendarDayDiff(startTime: string): number {
  const target = new Date(startTime)
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const now = new Date()
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((targetDay.getTime() - nowDay.getTime()) / msPerDay)
}

export default function SchedulePage() {
  const tCommon = useTranslations('common')
  const tSchedule = useTranslations('schedule')
  const tUpcoming = useTranslations('widgets.upcomingMeetings')
  const [filter, setFilter] = useState<ScheduleFilter>('all')
  const [events, setEvents] = useState<ScheduleMeetingEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [preparationById, setPreparationById] = useState<Record<string, MeetingPreparationResponse>>({})
  const [loadingPreparationById, setLoadingPreparationById] = useState<Record<string, boolean>>({})
  const [preparationErrorById, setPreparationErrorById] = useState<Record<string, string | null>>({})
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let active = true

    async function loadMeetings() {
      setLoadingEvents(true)
      setEventsError(null)

      try {
        const response = await fetch('/api/meetings?kind=upcoming&limit=20', { cache: 'no-store' })
        if (!response.ok) throw new Error(`Failed with status ${response.status}`)

        const data = (await response.json()) as MeetingsApiResponse
        const meetings = normalizeMeetingsResponse(data)
        const mappedEvents = meetings.map(toScheduleEvent)

        if (active) {
          setEvents(mappedEvents)
        }
      } catch {
        if (active) {
          setEvents([])
          setEventsError(tSchedule('errors.loadEvents'))
        }
      } finally {
        if (active) {
          setLoadingEvents(false)
        }
      }
    }

    void loadMeetings()

    return () => {
      active = false
    }
  }, [tSchedule])

  async function loadPreparation(meetingId: string) {
    try {
      setLoadingPreparationById((prev) => ({ ...prev, [meetingId]: true }))
      setPreparationErrorById((prev) => ({ ...prev, [meetingId]: null }))

      const response = await fetch(`/api/meetings/${meetingId}/preparation`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }

      const data = (await response.json()) as MeetingPreparationResponse
      setPreparationById((prev) => ({ ...prev, [meetingId]: data }))
    } catch {
      setPreparationErrorById((prev) => ({ ...prev, [meetingId]: tUpcoming('preparationError') }))
    } finally {
      setLoadingPreparationById((prev) => ({ ...prev, [meetingId]: false }))
    }
  }

  function togglePreparation(meetingId: string) {
    const nextExpanded = !Boolean(expandedById[meetingId])

    setExpandedById((prev) => ({
      ...prev,
      [meetingId]: nextExpanded,
    }))

    if (nextExpanded && !preparationById[meetingId] && !loadingPreparationById[meetingId]) {
      void loadPreparation(meetingId)
    }
  }

  const getTimeGroup = (startTime: string): string => {
    const diffDays = getCalendarDayDiff(startTime)
    if (diffDays === 0) return tSchedule('timeline.today')
    if (diffDays === 1) return tSchedule('timeline.tomorrow')
    if (diffDays <= 7) return tSchedule('timeline.thisWeek')
    if (diffDays <= 14) return tSchedule('timeline.nextWeek')
    return tSchedule('timeline.later')
  }

  const filteredEvents = useMemo(
    () => events.filter((event) => filter === 'all' || event.type === 'meeting'),
    [events, filter]
  )

  const groupedEvents = useMemo(() => {
    const grouped: Record<string, ScheduleMeetingEvent[]> = {}

    filteredEvents.forEach((event) => {
      const group = getTimeGroup(event.startTime)
      if (!grouped[group]) grouped[group] = []
      grouped[group].push(event)
    })

    return grouped
  }, [filteredEvents])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="schedule" />

      <main className="container mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/dashboard" className="text-primary hover:text-primary/80 mb-4 inline-block text-sm">
            ← {tCommon('navigation.dashboard')}
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">{tSchedule('title')}</h1>
          <p className="text-muted-foreground">{tSchedule('subtitle')}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6 flex gap-2">
          {(['all', 'meetings'] as const).map((f) => (
            <Button key={f} variant={filter === f ? 'default' : 'secondary'} size="sm" onClick={() => setFilter(f)}>
              {tSchedule(`filters.${f}`)}
            </Button>
          ))}
        </motion.div>

        {loadingEvents ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {[1, 2, 3].map((skeleton) => (
              <Skeleton key={skeleton} className="h-44 rounded-xl" />
            ))}
          </motion.div>
        ) : eventsError ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-destructive text-xl">{eventsError}</p>
          </motion.div>
        ) : filteredEvents.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-muted-foreground text-xl">{tSchedule('empty')}</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-8">
            {Object.entries(groupedEvents).map(([group, groupEvents]) => (
              <div key={group}>
                <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  {group}
                </h2>
                <div className="space-y-4 ml-5 border-l-2 border-border pl-6">
                  {groupEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className="relative"
                    >
                      <div className="absolute -left-[2.15rem] top-6 w-4 h-4 bg-primary rounded-full border-4 border-background" />
                      <Card className="backdrop-blur hover:border-primary/50 transition-all">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-foreground">{event.title}</h3>
                              <Badge variant="outline" className={cn(getTypeBadgeClass(event.type))}>
                                {tSchedule(`types.${event.type}`)}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {new Date(event.startTime).toLocaleDateString()}</span>
                            {event.endTime && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                                  {new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            )}
                          </div>
                          {event.organizer && (
                            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
                              {tSchedule('event.organizer')}: <span className="text-foreground flex items-center gap-1"><User className="h-3.5 w-3.5" /> {event.organizer}</span>
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => togglePreparation(event.id)}
                            className="mt-3 w-full text-left text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center justify-between"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" />
                              {expandedById[event.id] ? tUpcoming('hidePreparation') : tUpcoming('prepare')}
                            </span>
                            {expandedById[event.id] ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {expandedById[event.id] && (
                            <div className="mt-3 rounded-md bg-background/60 border border-border p-3 space-y-2">
                              {loadingPreparationById[event.id] && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {tSchedule('preparation.loading')}
                                </div>
                              )}

                              {!loadingPreparationById[event.id] && preparationErrorById[event.id] && (
                                <p className="text-xs text-destructive">{preparationErrorById[event.id]}</p>
                              )}

                              {!loadingPreparationById[event.id] && !preparationErrorById[event.id] && preparationById[event.id] && (
                                <>
                                  <p className="text-xs text-muted-foreground">
                                    {tUpcoming('prepSummary', {
                                      carryOver: preparationById[event.id].carryOverTopics.length,
                                      longRunning: preparationById[event.id].longRunningTasks.length,
                                    })}
                                  </p>

                                  {preparationById[event.id].prepStatus.reasons.length > 0 && (
                                    <p className="text-xs text-muted-foreground">{preparationById[event.id].prepStatus.reasons[0]}</p>
                                  )}

                                  <p className="text-xs font-semibold text-foreground">{tUpcoming('agendaPreviewTitle')}</p>

                                  {preparationById[event.id].preparedAgenda.length > 0 ? (
                                    <ul className="space-y-1">
                                      {preparationById[event.id].preparedAgenda.slice(0, 2).map((item, agendaIndex) => (
                                        <li key={`${event.id}-agenda-${agendaIndex}`} className="text-xs text-muted-foreground">
                                          • {item.title}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">{tUpcoming('noAgenda')}</p>
                                  )}

                                  <Link
                                    href={`/meetings/${event.id}/preparation`}
                                    className="inline-flex text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                  >
                                    {tUpcoming('viewFullPreparation')} →
                                  </Link>
                                </>
                              )}
                            </div>
                          )}

                          {event.agentSuggestion && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <p className="text-xs text-primary mb-1">{tSchedule('event.agentSuggestion')}</p>
                              <p className="text-sm text-muted-foreground italic">{event.agentSuggestion}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  )
}

function getTypeBadgeClass(_type: ScheduleMeetingEvent['type']) {
  return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
}
