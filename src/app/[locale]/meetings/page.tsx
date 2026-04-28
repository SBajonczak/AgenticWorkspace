'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { MeetingIndexingStatus, MeetingListItem, MeetingsApiResponse } from '@/types/meetings'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { User, Calendar, CheckCircle, Search, Loader2, FileText } from 'lucide-react'

type IndexingStatusFilter = 'all' | MeetingIndexingStatus

function buildApiUrl(params: {
  hasTranscript: boolean
  nameSearch: string
  indexingStatus: IndexingStatusFilter
}): string {
  const search = new URLSearchParams({
    scope: 'user',
    limit: '100',
    hasTranscript: params.hasTranscript ? 'true' : 'false',
  })
  if (params.nameSearch.trim()) {
    search.set('nameSearch', params.nameSearch.trim())
  }
  if (params.indexingStatus !== 'all') {
    search.set('indexingStatus', params.indexingStatus)
  }
  return `/api/meetings?${search.toString()}`
}

export default function MeetingsListPage() {
  const tCommon = useTranslations('common')
  const tList = useTranslations('meetings.list')

  const [meetings, setMeetings] = useState<MeetingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [hasTranscript, setHasTranscript] = useState(true)
  const [nameSearch, setNameSearch] = useState('')
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatusFilter>('all')

  // Per-meeting indexing trigger state
  const [indexingMeetingIds, setIndexingMeetingIds] = useState<Set<string>>(new Set())
  const [indexingMessages, setIndexingMessages] = useState<Record<string, string>>({})

  // Debounce name search
  const nameSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedNameSearch, setDebouncedNameSearch] = useState('')

  useEffect(() => {
    if (nameSearchTimer.current) clearTimeout(nameSearchTimer.current)
    nameSearchTimer.current = setTimeout(() => setDebouncedNameSearch(nameSearch), 400)
    return () => {
      if (nameSearchTimer.current) clearTimeout(nameSearchTimer.current)
    }
  }, [nameSearch])

  const loadMeetings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = buildApiUrl({ hasTranscript, nameSearch: debouncedNameSearch, indexingStatus })
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Status ${response.status}`)
      const data = (await response.json()) as MeetingsApiResponse
      const loaded = Array.isArray(data) ? data : data.meetings
      setMeetings(loaded || [])
    } catch {
      setError('Besprechungen konnten nicht geladen werden.')
      setMeetings([])
    } finally {
      setLoading(false)
    }
  }, [hasTranscript, debouncedNameSearch, indexingStatus])

  useEffect(() => {
    loadMeetings()
  }, [loadMeetings])

  async function handleIndexMeeting(meetingId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    setIndexingMeetingIds((prev) => new Set(prev).add(meetingId))
    setIndexingMessages((prev) => ({ ...prev, [meetingId]: '' }))

    try {
      const res = await fetch(`/api/meetings/${meetingId}/index`, { method: 'POST' })
      if (res.status === 202) {
        setIndexingMessages((prev) => ({ ...prev, [meetingId]: tList('indexQueued') }))
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === meetingId
              ? { ...m, isIndexing: true, indexingStatus: 'processing', status: 'processing' }
              : m
          )
        )
      } else if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        setIndexingMessages((prev) => ({
          ...prev,
          [meetingId]: body?.error ?? tList('indexingInProgress'),
        }))
      } else {
        setIndexingMessages((prev) => ({ ...prev, [meetingId]: tList('indexFailed') }))
      }
    } catch {
      setIndexingMessages((prev) => ({ ...prev, [meetingId]: tList('indexFailed') }))
    } finally {
      setIndexingMeetingIds((prev) => {
        const next = new Set(prev)
        next.delete(meetingId)
        return next
      })
    }
  }

  function getStatusBadgeClass(status: MeetingListItem['status']) {
    switch (status) {
      case 'completed':  return 'border-green-500/30 bg-green-500/20 text-green-400'
      case 'upcoming':   return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
      case 'processing': return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
      case 'cancelled':  return 'border-red-500/30 bg-red-500/20 text-red-400'
    }
  }

  const indexingStatusOptions: { value: IndexingStatusFilter; label: string }[] = [
    { value: 'all',         label: tList('indexingStatus.all') },
    { value: 'not_indexed', label: tList('indexingStatus.not_indexed') },
    { value: 'indexed',     label: tList('indexingStatus.indexed') },
    { value: 'processing',  label: tList('indexingStatus.processing') },
  ]

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

        {/* Filter bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-6 flex flex-wrap gap-3 items-center"
        >
          {/* Name search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder={tList('filters.nameSearch')}
              className="pl-9"
            />
          </div>

          {/* Transcript toggle */}
          <Button
            variant={hasTranscript ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setHasTranscript((v) => !v)}
            className="gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            {tList('filters.transcriptOnly')}
          </Button>

          {/* Indexing status filter */}
          <div className="flex gap-1 flex-wrap">
            {indexingStatusOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={indexingStatus === opt.value ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setIndexingStatus(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </motion.div>

        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </motion.div>
        ) : error ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-destructive text-xl">{error}</p>
          </motion.div>
        ) : meetings.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-muted-foreground text-xl">{tList('empty')}</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-4">
            {meetings.map((meeting, index) => {
              const isTriggering = indexingMeetingIds.has(meeting.id)
              const indexMessage = indexingMessages[meeting.id]
              const canIndex = !meeting.processedAt && !meeting.isIndexing && !isTriggering

              return (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <Link href={`/meetings/${meeting.id}`} className="block">
                    <Card className="backdrop-blur hover:border-primary/50 transition-all cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-foreground mb-2 truncate">{meeting.title}</h3>
                            {meeting.summary && (
                              <p className="text-muted-foreground mb-3 line-clamp-2">{meeting.summary}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" /> {meeting.organizer}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" /> {new Date(meeting.startTime).toLocaleDateString()}
                              </span>
                              {meeting.todos.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1.5">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    {meeting.todos.length}{' '}
                                    {meeting.todos.length === 1 ? tList('actionCount') : tList('actionCount_plural')}
                                  </span>
                                </>
                              )}
                              {indexMessage && (
                                <span className="text-xs text-primary">{indexMessage}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className={cn(getStatusBadgeClass(meeting.status))}
                            >
                              {tList(`status.${meeting.status}`)}
                            </Badge>

                            {canIndex && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs gap-1.5"
                                onClick={(e) => handleIndexMeeting(meeting.id, e)}
                              >
                                {tList('indexButton')}
                              </Button>
                            )}
                            {(meeting.isIndexing || isTriggering) && (
                              <span className="flex items-center gap-1 text-xs text-yellow-400">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {tList('indexingInProgress')}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </main>
    </div>
  )
}
