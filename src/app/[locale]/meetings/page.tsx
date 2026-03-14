'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { MeetingListItem, MeetingsApiResponse } from '@/types/meetings'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { User, Calendar, CheckCircle } from 'lucide-react'

export default function MeetingsListPage() {
  const tCommon = useTranslations('common')
  const tList = useTranslations('meetings.list')
  const [filter, setFilter] = useState<'all' | 'completed' | 'upcoming'>('all')
  const [meetings, setMeetings] = useState<MeetingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const loadMeetings = async () => {
      try {
        const response = await fetch('/api/meetings?kind=all&limit=100')
        if (!response.ok) throw new Error(`Failed with status ${response.status}`)
        const data = (await response.json()) as MeetingsApiResponse
        const loadedMeetings = Array.isArray(data) ? data : data.meetings
        if (active) { setMeetings(loadedMeetings || []); setError(null) }
      } catch {
        if (active) { setError('Meetings konnten nicht geladen werden.'); setMeetings([]) }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadMeetings()
    return () => { active = false }
  }, [])

  const filteredMeetings = meetings.filter((m) => filter === 'all' || m.status === filter)

  const getStatusBadgeClass = (status: MeetingListItem['status']) => {
    switch (status) {
      case 'completed': return 'border-green-500/30 bg-green-500/20 text-green-400'
      case 'upcoming':  return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
      case 'cancelled': return 'border-red-500/30 bg-red-500/20 text-red-400'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="meetings" />

      <main className="container mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/dashboard" className="text-primary hover:text-primary/80 mb-4 inline-block text-sm">
            ← {tCommon('navigation.dashboard')}
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">{tList('title')}</h1>
          <p className="text-muted-foreground">{tList('subtitle')}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6 flex gap-2">
          {(['all', 'completed', 'upcoming'] as const).map((item) => (
            <Button key={item} variant={filter === item ? 'default' : 'secondary'} size="sm" onClick={() => setFilter(item)}>
              {tList(`filters.${item}`)}
            </Button>
          ))}
        </motion.div>

        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </motion.div>
        ) : error ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-destructive text-xl">{error}</p>
          </motion.div>
        ) : filteredMeetings.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-muted-foreground text-xl">{tList('empty')}</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-4">
            {filteredMeetings.map((meeting, index) => (
              <motion.div key={meeting.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * index }}>
                <Link href={`/meetings/${meeting.id}`} className="block">
                  <Card className="backdrop-blur hover:border-primary/50 transition-all cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-foreground mb-2">{meeting.title}</h3>
                          {meeting.summary && (
                            <p className="text-muted-foreground mb-3 line-clamp-2">{meeting.summary}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {meeting.organizer}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {new Date(meeting.startTime).toLocaleDateString()}</span>
                            {meeting.todos.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> {meeting.todos.length} {meeting.todos.length === 1 ? tList('actionCount') : tList('actionCount_plural')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('ml-4 shrink-0', getStatusBadgeClass(meeting.status))}>
                          {tList(`status.${meeting.status}`)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  )
}
