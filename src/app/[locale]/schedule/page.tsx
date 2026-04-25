'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import {
  MeetingListItem,
  MeetingOptimizationResponse,
  MeetingOptimizationSuggestion,
  MeetingPreparationResponse,
  MeetingsApiResponse,
} from '@/types/meetings'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Loader2,
  Sparkles,
  User,
  Wand2,
} from 'lucide-react'

type ScheduleViewMode = 'day' | 'week' | 'month'

interface ScheduleMeetingEvent {
  id: string
  title: string
  type: 'meeting'
  startTime: string
  endTime: string
  organizer: string
  agentSuggestion?: string
}

interface DayBucket {
  date: Date
  events: ScheduleMeetingEvent[]
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

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeekMonday(value: Date): Date {
  const day = value.getDay()
  const delta = day === 0 ? -6 : 1 - day
  return startOfDay(addDays(value, delta))
}

function formatDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTimeRange(startTime: string, endTime: string): string {
  const start = new Date(startTime)
  const end = new Date(endTime)
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export default function SchedulePage() {
  const tCommon = useTranslations('common')
  const tSchedule = useTranslations('schedule')
  const tUpcoming = useTranslations('widgets.upcomingMeetings')
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('week')
  const [anchorDate, setAnchorDate] = useState<Date>(startOfDay(new Date()))
  const [events, setEvents] = useState<ScheduleMeetingEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [preparationById, setPreparationById] = useState<Record<string, MeetingPreparationResponse>>({})
  const [loadingPreparationById, setLoadingPreparationById] = useState<Record<string, boolean>>({})
  const [preparationErrorById, setPreparationErrorById] = useState<Record<string, string | null>>({})
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({})
  const [optimizationById, setOptimizationById] = useState<Record<string, MeetingOptimizationSuggestion[]>>({})
  const [optimizationGeneratedAtById, setOptimizationGeneratedAtById] = useState<Record<string, string>>({})
  const [loadingOptimizationById, setLoadingOptimizationById] = useState<Record<string, boolean>>({})
  const [optimizationErrorById, setOptimizationErrorById] = useState<Record<string, string | null>>({})
  const [applyingSuggestionById, setApplyingSuggestionById] = useState<Record<string, string | null>>({})

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

  async function loadOptimizationSuggestions(meetingId: string) {
    try {
      setLoadingOptimizationById((prev) => ({ ...prev, [meetingId]: true }))
      setOptimizationErrorById((prev) => ({ ...prev, [meetingId]: null }))

      const response = await fetch(`/api/meetings/${meetingId}/optimization-suggestions`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }

      const data = (await response.json()) as MeetingOptimizationResponse
      setOptimizationById((prev) => ({ ...prev, [meetingId]: data.suggestions }))
      setOptimizationGeneratedAtById((prev) => ({ ...prev, [meetingId]: data.generatedAt }))
    } catch {
      setOptimizationErrorById((prev) => ({ ...prev, [meetingId]: tSchedule('optimization.loadError') }))
    } finally {
      setLoadingOptimizationById((prev) => ({ ...prev, [meetingId]: false }))
    }
  }

  async function applySuggestion(meetingId: string, suggestion: MeetingOptimizationSuggestion) {
    try {
      setApplyingSuggestionById((prev) => ({ ...prev, [meetingId]: suggestion.id }))
      setOptimizationErrorById((prev) => ({ ...prev, [meetingId]: null }))

      const response = await fetch(`/api/meetings/${meetingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStartTime: suggestion.targetStartTime,
          targetEndTime: suggestion.targetEndTime,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }

      setEvents((prev) =>
        prev.map((event) =>
          event.id === meetingId
            ? {
                ...event,
                startTime: suggestion.targetStartTime,
                endTime: suggestion.targetEndTime,
              }
            : event
        )
      )

      await loadOptimizationSuggestions(meetingId)
    } catch {
      setOptimizationErrorById((prev) => ({ ...prev, [meetingId]: tSchedule('optimization.applyError') }))
    } finally {
      setApplyingSuggestionById((prev) => ({ ...prev, [meetingId]: null }))
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

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') {
      return [startOfDay(anchorDate)]
    }

    if (viewMode === 'week') {
      const weekStart = startOfWeekMonday(anchorDate)
      return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    }

    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
    const gridStart = startOfWeekMonday(monthStart)
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  }, [anchorDate, viewMode])

  const dayBuckets = useMemo<DayBucket[]>(() => {
    const eventMap = new Map<string, ScheduleMeetingEvent[]>()
    events.forEach((event) => {
      const key = formatDateKey(new Date(event.startTime))
      const bucket = eventMap.get(key) ?? []
      bucket.push(event)
      eventMap.set(key, bucket)
    })

    return visibleDays.map((day) => {
      const key = formatDateKey(day)
      const bucketEvents = (eventMap.get(key) ?? []).sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
      return { date: day, events: bucketEvents }
    })
  }, [events, visibleDays])

  const anchorLabel = useMemo(() => {
    if (viewMode === 'month') {
      return anchorDate.toLocaleDateString([], { month: 'long', year: 'numeric' })
    }
    if (viewMode === 'week') {
      const start = startOfWeekMonday(anchorDate)
      const end = addDays(start, 6)
      return `${start.toLocaleDateString([], { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}`
    }
    return anchorDate.toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
  }, [anchorDate, viewMode])

  const navigateWindow = (direction: -1 | 1) => {
    if (viewMode === 'month') {
      setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1))
      return
    }
    if (viewMode === 'week') {
      setAnchorDate((prev) => addDays(prev, direction * 7))
      return
    }
    setAnchorDate((prev) => addDays(prev, direction))
  }

  const today = startOfDay(new Date())

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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" onClick={() => navigateWindow(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAnchorDate(startOfDay(new Date()))}>
              {tSchedule('calendar.today')}
            </Button>
            <Button variant="secondary" size="icon" onClick={() => navigateWindow(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground ml-2">{anchorLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <Button key={mode} variant={viewMode === mode ? 'default' : 'secondary'} size="sm" onClick={() => setViewMode(mode)}>
                {tSchedule(`calendar.viewModes.${mode}`)}
            </Button>
          ))}
          </div>
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
        ) : events.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-muted-foreground text-xl">{tSchedule('empty')}</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={cn('grid gap-4', viewMode === 'month' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-7' : 'grid-cols-1 lg:grid-cols-7')}
          >
            {dayBuckets.map((bucket, index) => {
              const inCurrentMonth = bucket.date.getMonth() === anchorDate.getMonth()
              const highlightToday = isSameDay(bucket.date, today)
              return (
                <Card
                  key={`${formatDateKey(bucket.date)}-${index}`}
                  className={cn(
                    'min-h-40 backdrop-blur border-border/70',
                    highlightToday && 'border-primary/70',
                    viewMode === 'month' && !inCurrentMonth && 'opacity-60'
                  )}
                >
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className={cn('text-xs font-semibold', highlightToday ? 'text-primary' : 'text-muted-foreground')}>
                        {bucket.date.toLocaleDateString([], {
                          weekday: viewMode === 'month' ? 'short' : 'long',
                          day: '2-digit',
                          month: viewMode === 'day' ? 'long' : 'short',
                        })}
                      </p>
                      <Badge variant="outline" className="text-[10px]">{bucket.events.length}</Badge>
                    </div>

                    <div className="space-y-2">
                      {bucket.events.length === 0 && (
                        <p className="text-xs text-muted-foreground">{tSchedule('calendar.noEvents')}</p>
                      )}

                      {bucket.events.map((event) => (
                        <div key={event.id} className="rounded-md border border-border/70 bg-background/60 p-2 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <Link href={`/meetings/${event.id}`} className="text-sm font-semibold text-foreground hover:text-primary">
                                {event.title}
                              </Link>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimeRange(event.startTime, event.endTime)}
                              </p>
                            </div>
                            <Badge variant="outline" className={cn(getTypeBadgeClass(event.type))}>
                              {tSchedule(`types.${event.type}`)}
                            </Badge>
                          </div>

                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.organizer}
                          </p>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => void loadOptimizationSuggestions(event.id)} disabled={loadingOptimizationById[event.id]}>
                              {loadingOptimizationById[event.id] ? (
                                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {tSchedule('optimization.loading')}</span>
                              ) : (
                                <span className="inline-flex items-center gap-1"><Wand2 className="h-3 w-3" /> {tSchedule('optimization.getSuggestions')}</span>
                              )}
                            </Button>

                            <button
                              type="button"
                              onClick={() => togglePreparation(event.id)}
                              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                            >
                              <Sparkles className="h-3 w-3" />
                              {expandedById[event.id] ? tUpcoming('hidePreparation') : tUpcoming('prepare')}
                              {expandedById[event.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          </div>

                          {optimizationErrorById[event.id] && (
                            <p className="text-xs text-destructive">{optimizationErrorById[event.id]}</p>
                          )}

                          {optimizationById[event.id]?.length > 0 && (
                            <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                              <p className="text-xs font-semibold text-foreground">{tSchedule('optimization.title')}</p>
                              {optimizationById[event.id].map((suggestion) => (
                                <div key={suggestion.id} className="rounded border border-border/70 bg-background/80 p-2">
                                  <p className="text-xs text-foreground font-medium">{formatTimeRange(suggestion.targetStartTime, suggestion.targetEndTime)}</p>
                                  <p className="text-[11px] text-muted-foreground">{suggestion.reason}</p>
                                  <p className="text-[11px] text-muted-foreground">{tSchedule('optimization.score')}: {suggestion.score}</p>
                                  <Button
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => void applySuggestion(event.id, suggestion)}
                                    disabled={applyingSuggestionById[event.id] === suggestion.id}
                                  >
                                    {applyingSuggestionById[event.id] === suggestion.id ? tSchedule('optimization.applying') : tSchedule('optimization.apply')}
                                  </Button>
                                </div>
                              ))}
                              {optimizationGeneratedAtById[event.id] && (
                                <p className="text-[11px] text-muted-foreground">
                                  {tSchedule('optimization.generatedAt', {
                                    time: new Date(optimizationGeneratedAtById[event.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                  })}
                                </p>
                              )}
                            </div>
                          )}

                          {expandedById[event.id] && (
                            <div className="rounded-md bg-background/60 border border-border p-3 space-y-2">
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

                                  <Link href={`/meetings/${event.id}/preparation`} className="inline-flex text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                                    {tUpcoming('viewFullPreparation')} →
                                  </Link>
                                </>
                              )}
                            </div>
                          )}

                          {event.agentSuggestion && (
                            <div className="pt-1 border-t border-border/60">
                              <p className="text-xs text-primary mb-1">{tSchedule('event.agentSuggestion')}</p>
                              <p className="text-xs text-muted-foreground italic line-clamp-2">{event.agentSuggestion}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>
        )}
      </main>
    </div>
  )
}

function getTypeBadgeClass(_type: ScheduleMeetingEvent['type']) {
  return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
}
