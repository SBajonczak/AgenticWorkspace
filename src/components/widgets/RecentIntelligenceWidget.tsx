'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { MeetingListItem } from '@/types/meetings'

interface RecentIntelligenceWidgetProps {
  meetings: MeetingListItem[]
}

export default function RecentIntelligenceWidget({ meetings }: RecentIntelligenceWidgetProps) {
  const t = useTranslations('widgets.recentIntelligence')
  const tCommon = useTranslations('common')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-900/50 to-gray-800/50 backdrop-blur rounded-2xl p-6 border border-purple-500/30 hover:border-purple-500/50 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{t('title')}</h3>
          <p className="text-sm text-gray-400">{t('subtitle')}</p>
        </div>
        <span className="text-3xl">🧠</span>
      </div>

      {meetings.length === 0 ? (
        <p className="text-gray-400 text-center py-8">{t('noMeetings')}</p>
      ) : (
        <div className="space-y-3 mb-4">
          {meetings.slice(0, 3).map((meeting, index) => (
            <Link
              key={meeting.id}
              href={`/meetings/${meeting.id}`}
              className="block bg-gray-900/50 rounded-lg p-4 hover:bg-gray-900/70 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-white font-semibold mb-1">{meeting.title}</h4>
                  <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                    {meeting.summary || 'Processing...'}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>👤 {meeting.organizer}</span>
                    <span>•</span>
                    <span>
                      {meeting.todos.length} {meeting.todos.length === 1 ? t('actionCount') : t('actionCount_plural')}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/meetings"
        className="block text-center text-purple-400 hover:text-purple-300 transition-colors text-sm font-semibold"
      >
        {t('viewAll')} →
      </Link>
    </motion.div>
  )
}
