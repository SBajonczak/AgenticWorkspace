'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { MeetingListItem } from '@/types/meetings'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, User } from 'lucide-react'

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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="bg-card border-border hover:shadow-md transition-all rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-1">{t('title')}</h3>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="border-emerald-400/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-300" />
                {t('live')}
              </Badge>
              {lastUpdatedLabel && (
                <span className="text-[11px] text-muted-foreground">{lastUpdatedLabel}</span>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {meetings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noMeetings')}</p>
          ) : (
            <div className="space-y-3">
              {meetings.slice(0, 3).map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/meetings/${meeting.id}`}
                  className="block bg-muted/40 rounded-lg p-4 hover:bg-muted/70 transition-colors"
                >
                  <h4 className="text-foreground font-semibold mb-1">{meeting.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {meeting.summary || 'Processing...'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{meeting.organizer}</span>
                    <span>•</span>
                    <span>
                      {meeting.todos.length} {meeting.todos.length === 1 ? t('actionCount') : t('actionCount_plural')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Link
            href="/meetings"
            className="w-full text-center text-primary hover:text-primary/80 transition-colors text-sm font-semibold"
          >
            {t('viewAll')} →
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
