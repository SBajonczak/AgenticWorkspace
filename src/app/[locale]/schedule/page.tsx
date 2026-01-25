'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { getUpcomingEvents, ScheduleEvent } from '@/mocks'

export default function SchedulePage() {
  const tCommon = useTranslations('common')
  const tSchedule = useTranslations('schedule')
  const [filter, setFilter] = useState<'all' | 'meetings' | 'deadlines' | 'milestones'>('all')

  const events = getUpcomingEvents()
  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true
    if (filter === 'meetings') return e.type === 'meeting'
    if (filter === 'deadlines') return e.type === 'deadline'
    if (filter === 'milestones') return e.type === 'milestone'
    return true
  })

  const getTypeColor = (type: ScheduleEvent['type']) => {
    switch (type) {
      case 'meeting':
        return 'bg-blue-500/20 text-blue-400'
      case 'deadline':
        return 'bg-red-500/20 text-red-400'
      case 'milestone':
        return 'bg-green-500/20 text-green-400'
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

  // Group events by time
  const groupedEvents: Record<string, ScheduleEvent[]> = {}
  filteredEvents.forEach(event => {
    const group = getTimeGroup(event.startTime)
    if (!groupedEvents[group]) {
      groupedEvents[group] = []
    }
    groupedEvents[group].push(event)
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              {tCommon('brand.name')}
            </Link>
            <nav className="flex gap-6 items-center">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                {tCommon('navigation.dashboard')}
              </Link>
              <LanguageSwitcher />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            href="/dashboard"
            className="text-purple-400 hover:text-purple-300 mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">{tSchedule('title')}</h1>
          <p className="text-gray-400">{tSchedule('subtitle')}</p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex gap-3"
        >
          {(['all', 'meetings', 'deadlines', 'milestones'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tSchedule(`filters.${f}`)}
            </button>
          ))}
        </motion.div>

        {/* Timeline */}
        {filteredEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-gray-400 text-xl">{tSchedule('empty')}</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            {Object.entries(groupedEvents).map(([group, events]) => (
              <div key={group}>
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  {group}
                </h2>
                <div className="space-y-4 ml-5 border-l-2 border-gray-700 pl-6">
                  {events.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all relative"
                    >
                      <div className="absolute -left-[2.15rem] top-6 w-4 h-4 bg-purple-500 rounded-full border-4 border-gray-900"></div>
                      
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-white">{event.title}</h3>
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getTypeColor(event.type)}`}>
                              {tSchedule(`types.${event.type}`)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>📅 {new Date(event.startTime).toLocaleDateString()}</span>
                            {event.endTime && (
                              <>
                                <span>•</span>
                                <span>
                                  ⏱️ {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {event.organizer && (
                        <p className="text-sm text-gray-400 mb-2">
                          {tSchedule('event.organizer')}: <span className="text-white">👤 {event.organizer}</span>
                        </p>
                      )}

                      {event.location && (
                        <p className="text-sm text-gray-400 mb-2">
                          {tSchedule('event.location')}: <span className="text-white">📍 {event.location}</span>
                        </p>
                      )}

                      {event.relatedProjectId && (
                        <Link
                          href={`/projects/${event.relatedProjectId}`}
                          className="text-sm text-purple-400 hover:text-purple-300 mb-2 inline-block"
                        >
                          🔗 {tSchedule('event.relatedProject')} →
                        </Link>
                      )}

                      {event.agentSuggestion && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <p className="text-xs text-purple-400 mb-1">{tSchedule('event.agentSuggestion')}</p>
                          <p className="text-sm text-gray-300 italic">{event.agentSuggestion}</p>
                        </div>
                      )}
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
