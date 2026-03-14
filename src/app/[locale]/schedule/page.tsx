'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { getUpcomingEvents, ScheduleEvent } from '@/mocks'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Calendar, Clock, User, MapPin, ExternalLink } from 'lucide-react'

export default function SchedulePage() {
  const tCommon = useTranslations('common')
  const tSchedule = useTranslations('schedule')
  const [filter, setFilter] = useState<'all' | 'meetings' | 'deadlines' | 'milestones'>('all')

  const events = getUpcomingEvents()
  const filteredEvents = events.filter((e) => {
    if (filter === 'all') return true
    if (filter === 'meetings') return e.type === 'meeting'
    if (filter === 'deadlines') return e.type === 'deadline'
    if (filter === 'milestones') return e.type === 'milestone'
    return true
  })

  const getTypeBadgeClass = (type: ScheduleEvent['type']) => {
    switch (type) {
      case 'meeting':   return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
      case 'deadline':  return 'border-red-500/30 bg-red-500/20 text-red-400'
      case 'milestone': return 'border-green-500/30 bg-green-500/20 text-green-400'
    }
  }

  const getTimeGroup = (startTime: string): string => {
    const start = new Date(startTime)
    const now = new Date()
    const diffDays = Math.floor((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return tSchedule('timeline.today')
    if (diffDays === 1) return tSchedule('timeline.tomorrow')
    if (diffDays <= 7) return tSchedule('timeline.thisWeek')
    if (diffDays <= 14) return tSchedule('timeline.nextWeek')
    return tSchedule('timeline.later')
  }

  const groupedEvents: Record<string, ScheduleEvent[]> = {}
  filteredEvents.forEach((event) => {
    const group = getTimeGroup(event.startTime)
    if (!groupedEvents[group]) groupedEvents[group] = []
    groupedEvents[group].push(event)
  })

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
          {(['all', 'meetings', 'deadlines', 'milestones'] as const).map((f) => (
            <Button key={f} variant={filter === f ? 'default' : 'secondary'} size="sm" onClick={() => setFilter(f)}>
              {tSchedule(`filters.${f}`)}
            </Button>
          ))}
        </motion.div>

        {filteredEvents.length === 0 ? (
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
                          {event.location && (
                            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
                              {tSchedule('event.location')}: <span className="text-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>
                            </p>
                          )}
                          {event.relatedProjectId && (
                            <Link href={`/projects/${event.relatedProjectId}`} className="text-sm text-primary hover:text-primary/80 mb-2 inline-flex items-center gap-1">
                              <ExternalLink className="h-3.5 w-3.5" /> {tSchedule('event.relatedProject')} →
                            </Link>
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
