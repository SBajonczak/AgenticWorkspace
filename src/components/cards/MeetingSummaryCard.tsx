'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

interface Meeting {
  id: string
  title: string
  organizer: string
  startTime: string
  endTime: string
  summary: string
  decisions: string
  processedAt: string
}

interface MeetingSummaryCardProps {
  meeting: Meeting
}

export default function MeetingSummaryCard({ meeting }: MeetingSummaryCardProps) {
  const t = useTranslations('meetings')
  const decisions = JSON.parse(meeting.decisions)
  const startTime = new Date(meeting.startTime)
  const endTime = new Date(meeting.endTime)
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{meeting.title}</h2>
          <div className="flex items-center gap-4 text-gray-400">
            <span>👤 {meeting.organizer}</span>
            <span>•</span>
            <span>⏱️ {duration} {t('common.labels.minutes', { ns: 'common' })}</span>
            <span>•</span>
            <span>{startTime.toLocaleDateString()}</span>
          </div>
        </div>
        <Link
          href={`/meetings/${meeting.id}`}
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          {t('common.buttons.viewDetails', { ns: 'common' })} →
        </Link>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">{t('summary.title')}</h3>
        <p className="text-gray-300 leading-relaxed">{meeting.summary}</p>
      </div>

      {/* Decisions */}
      {decisions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">{t('summary.decisions')}</h3>
          <ul className="space-y-2">
            {decisions.map((decision: string, index: number) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-start gap-3 text-gray-300"
              >
                <span className="text-green-400 text-xl">✓</span>
                <span>{decision}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}
