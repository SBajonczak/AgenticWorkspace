'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getDecisionTopics, parseDecisionItems } from '@/lib/meetingDecisions'

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
  const tMeetings = useTranslations('meetings')
  const tCommon = useTranslations('common')
  const decisions = getDecisionTopics(parseDecisionItems(meeting.decisions))
  const startTime = new Date(meeting.startTime)
  const endTime = new Date(meeting.endTime)
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="backdrop-blur rounded-2xl">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">{meeting.title}</h2>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>👤 {meeting.organizer}</span>
                <span>•</span>
                <span>⏱️ {duration} {tCommon('labels.minutes')}</span>
                <span>•</span>
                <span>{startTime.toLocaleDateString()}</span>
              </div>
            </div>
            <Link
              href={`/meetings/${meeting.id}`}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              {tCommon('buttons.viewDetails')} →
            </Link>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">{tMeetings('summary.title')}</h3>
            <p className="text-muted-foreground leading-relaxed">{meeting.summary}</p>
          </div>

          {decisions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">{tMeetings('summary.decisions')}</h3>
              <ul className="space-y-2">
                {decisions.map((decision: string, index: number) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="flex items-start gap-3 text-muted-foreground"
                  >
                    <span className="text-green-400 text-xl">✓</span>
                    <span>{decision}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
