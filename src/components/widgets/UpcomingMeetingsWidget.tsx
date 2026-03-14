'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { MeetingListItem } from '@/types/meetings'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, User } from 'lucide-react'

interface UpcomingMeetingsWidgetProps {
  meetings: MeetingListItem[]
  lastUpdatedAt: string | null
}

export default function UpcomingMeetingsWidget({ meetings, lastUpdatedAt }: UpcomingMeetingsWidgetProps) {
  const t = useTranslations('widgets.upcomingMeetings')
  const lastUpdatedLabel = lastUpdatedAt
    ? t('updatedAt', {
        time: new Date(lastUpdatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
    : null

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
              {meetings.slice(0, 3).map((meeting) => (
                <div key={meeting.id} className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-foreground font-semibold mb-1">{meeting.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{meeting.organizer}</span>
                        <span>•</span>
                        <span>{new Date(meeting.startTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                      {getTimeUntil(meeting.startTime)}
                    </Badge>
                  </div>
                </div>
              ))}
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
