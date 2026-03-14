'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { MeetingListItem } from '@/types/meetings'

interface RecentIntelligenceWidgetProps {
  meetings: MeetingListItem[]
  lastUpdatedAt: string | null
}

export default function RecentIntelligenceWidget({ meetings, lastUpdatedAt }: RecentIntelligenceWidgetProps) {
  const t = useTranslations('widgets.recentIntelligence')
  const lastUpdatedLabel = lastUpdatedAt
    ? t('updatedAt', {
        time: new Date(lastUpdatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
    : null

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
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {t('live')}
          </span>
          {lastUpdatedLabel && <span className="text-[11px] text-gray-500">{lastUpdatedLabel}</span>}
          <span className="text-3xl">🧠</span>
        </div>
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
