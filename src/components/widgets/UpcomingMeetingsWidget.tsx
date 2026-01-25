'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Meeting } from '@/mocks'

interface UpcomingMeetingsWidgetProps {
  meetings: Meeting[]
}

export default function UpcomingMeetingsWidget({ meetings }: UpcomingMeetingsWidgetProps) {
  const t = useTranslations('widgets.upcomingMeetings')

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gradient-to-br from-blue-900/50 to-gray-800/50 backdrop-blur rounded-2xl p-6 border border-blue-500/30 hover:border-blue-500/50 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{t('title')}</h3>
          <p className="text-sm text-gray-400">{t('subtitle')}</p>
        </div>
        <span className="text-3xl">📅</span>
      </div>

      {meetings.length === 0 ? (
        <p className="text-gray-400 text-center py-8">{t('noMeetings')}</p>
      ) : (
        <div className="space-y-3 mb-4">
          {meetings.slice(0, 3).map((meeting, index) => (
            <div
              key={meeting.id}
              className="bg-gray-900/50 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-white font-semibold mb-1">{meeting.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>👤 {meeting.organizer}</span>
                    <span>•</span>
                    <span>{new Date(meeting.startTime).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                  {getTimeUntil(meeting.startTime)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/schedule"
        className="block text-center text-blue-400 hover:text-blue-300 transition-colors text-sm font-semibold"
      >
        {t('viewSchedule')} →
      </Link>
    </motion.div>
  )
}
