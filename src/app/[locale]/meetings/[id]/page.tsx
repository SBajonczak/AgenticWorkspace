'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'

type UiTodoStatus = 'open' | 'in_progress' | 'done'

interface MeetingDetailTodo {
  id: string
  title: string
  description: string
  assigneeHint: string | null
  confidence: number
  status: UiTodoStatus
  jiraSync: {
    id: string
    jiraIssueKey: string | null
    status: 'synced' | 'pending' | 'failed'
    syncedAt: string | null
  } | null
}

interface MeetingDetailModel {
  id: string
  title: string
  organizer: string
  startTime: string
  endTime: string
  transcript: string | null
  summary: string | null
  decisions: string | null
  todos: MeetingDetailTodo[]
}

interface MeetingApiTodo {
  id: string
  title: string
  description: string
  assigneeHint: string | null
  confidence: number
  status: string
  jiraSync: {
    id: string
    jiraIssueKey: string | null
    status: 'synced' | 'pending' | 'failed'
    syncedAt: string | null
  } | null
}

interface MeetingApiResponse {
  id: string
  title: string
  organizer: string
  startTime: string
  endTime: string
  transcript: string | null
  summary: string | null
  decisions: string | null
  todos: MeetingApiTodo[]
}

function mapTodoStatus(status: string): UiTodoStatus {
  if (status === 'in_progress' || status === 'done') return status
  return 'open'
}

function mapMeetingFromApi(payload: MeetingApiResponse): MeetingDetailModel {
  return {
    id: payload.id,
    title: payload.title,
    organizer: payload.organizer,
    startTime: payload.startTime,
    endTime: payload.endTime,
    transcript: payload.transcript,
    summary: payload.summary,
    decisions: payload.decisions,
    todos: (payload.todos || []).map((todo) => ({
      id: todo.id,
      title: todo.title,
      description: todo.description,
      assigneeHint: todo.assigneeHint,
      confidence: todo.confidence,
      status: mapTodoStatus(todo.status),
      jiraSync: todo.jiraSync,
    })),
  }
}

export default function MeetingDetailPage() {
  const params = useParams()
  const tCommon = useTranslations('common')
  const tDetail = useTranslations('meetings.detail')
  const [meeting, setMeeting] = useState<MeetingDetailModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meetingId = params.id as string

  useEffect(() => {
    let active = true
    const loadMeeting = async () => {
      try {
        setLoading(true); setError(null); setNotFound(false)
        const response = await fetch(`/api/meetings/${meetingId}`)
        if (response.status === 404) {
          if (active) { setMeeting(null); setNotFound(true) }
          return
        }
        if (!response.ok) throw new Error(`Failed with status ${response.status}`)
        const data = (await response.json()) as MeetingApiResponse
        if (active) setMeeting(mapMeetingFromApi(data))
      } catch {
        if (active) { setMeeting(null); setError('Meeting konnte nicht geladen werden.') }
      } finally {
        if (active) setLoading(false)
      }
    }
    if (meetingId) loadMeeting()
    return () => { active = false }
  }, [meetingId])

  const decisions = useMemo<string[]>(() => {
    if (!meeting?.decisions) return []
    try {
      const parsed = JSON.parse(meeting.decisions)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }, [meeting?.decisions])

  const getConfidenceClass = (c: number) =>
    c >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : c >= 0.7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-600 dark:text-orange-400'
  const getConfidenceLabel = (c: number) =>
    c >= 0.85 ? tCommon('labels.high') : c >= 0.7 ? tCommon('labels.medium') : tCommon('labels.low')
  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case 'done': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      case 'in_progress': return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400'
      default: return 'border-border bg-muted/20 text-muted-foreground'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-xl">{tCommon('labels.loading')}</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground text-2xl mb-4">Meeting not found</p>
          <Link href="/meetings" className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80">
            <ChevronLeft className="h-4 w-4" />
            {tDetail('backToList')}
          </Link>
        </div>
      </div>
    )
  }

  if (!meeting || error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground text-2xl mb-4">{error || 'Meeting not available'}</p>
          <Link href="/meetings" className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80">
            <ChevronLeft className="h-4 w-4" />
            {tDetail('backToList')}
          </Link>
        </div>
      </div>
    )
  }

  const startTime = new Date(meeting.startTime)
  const endTime = new Date(meeting.endTime)
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="meetings" />

      <main className="container mx-auto px-4 py-8">
        {/* Back link */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link
            href="/meetings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {tDetail('backToList')}
          </Link>
        </motion.div>

        {/* Two-column layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row gap-6 items-start"
        >
          {/* LEFT SIDEBAR */}
          <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24">
            <Card>
              <CardContent className="p-6 space-y-4">
                <h1 className="text-xl font-bold text-foreground leading-snug">
                  {meeting.title}
                </h1>

                <Separator />

                <dl className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-xs text-muted-foreground mb-0.5">
                        {tDetail('summary.metadata.organizer')}
                      </dt>
                      <dd className="text-foreground font-medium">{meeting.organizer}</dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-xs text-muted-foreground mb-0.5">
                        {tDetail('summary.metadata.date')}
                      </dt>
                      <dd className="text-foreground font-medium">
                        {startTime.toLocaleDateString()}
                      </dd>
                      <dd className="text-muted-foreground text-xs">
                        {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-xs text-muted-foreground mb-0.5">
                        {tDetail('summary.metadata.duration')}
                      </dt>
                      <dd className="text-foreground font-medium">
                        {duration} {tCommon('labels.minutes')}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-xs text-muted-foreground mb-0.5">
                        {tDetail('tabs.actions')}
                      </dt>
                      <dd className="text-foreground font-medium">
                        {meeting.todos.length > 0 ? (
                          <span>
                            {meeting.todos.filter(t => t.status === 'done').length}/{meeting.todos.length} {tDetail('actions.title').toLowerCase()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </dd>
                    </div>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </aside>

          {/* RIGHT CONTENT */}
          <div className="flex-1 min-w-0">
            {/* Title visible only on mobile */}
            <h1 className="text-2xl font-bold text-foreground mb-4 lg:hidden leading-snug">
              {meeting.title}
            </h1>

            <Tabs defaultValue="summary" className="flex-col w-full">
              <TabsList className="border-b border-border rounded-none bg-transparent w-full justify-start gap-1 h-auto pb-0 mb-0">
                <TabsTrigger
                  value="summary"
                  className="rounded-none border-b-2 border-transparent data-active:border-primary data-active:text-primary data-active:bg-transparent pb-2 px-4 text-sm font-medium text-muted-foreground data-active:text-foreground"
                >
                  {tDetail('tabs.summary')}
                </TabsTrigger>
                <TabsTrigger
                  value="decisions"
                  className="rounded-none border-b-2 border-transparent data-active:border-primary data-active:text-primary data-active:bg-transparent pb-2 px-4 text-sm font-medium text-muted-foreground data-active:text-foreground"
                >
                  {tDetail('tabs.decisions')}
                  {decisions.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">({decisions.length})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="actions"
                  className="rounded-none border-b-2 border-transparent data-active:border-primary data-active:text-primary data-active:bg-transparent pb-2 px-4 text-sm font-medium text-muted-foreground data-active:text-foreground"
                >
                  {tDetail('tabs.actions')}
                  {meeting.todos.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">({meeting.todos.length})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="transcript"
                  className="rounded-none border-b-2 border-transparent data-active:border-primary data-active:text-primary data-active:bg-transparent pb-2 px-4 text-sm font-medium text-muted-foreground data-active:text-foreground"
                >
                  {tDetail('tabs.transcript')}
                </TabsTrigger>
              </TabsList>

              {/* Summary */}
              <TabsContent value="summary" className="pt-6">
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{tDetail('summary.title')}</h2>
                  {meeting.summary ? (
                    <p className="text-muted-foreground leading-relaxed">{meeting.summary}</p>
                  ) : (
                    <p className="text-muted-foreground text-center py-12">—</p>
                  )}
                </motion.div>
              </TabsContent>

              {/* Decisions */}
              <TabsContent value="decisions" className="pt-6">
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">
                    {tDetail('decisions.title')} ({decisions.length})
                  </h2>
                  {decisions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-12">{tDetail('decisions.noDecisions')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {decisions.map((decision, index) => (
                        <li key={index} className="flex items-start gap-3 bg-muted/40 rounded-lg p-4">
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{decision}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              </TabsContent>

              {/* Actions */}
              <TabsContent value="actions" className="pt-6">
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{tDetail('actions.title')}</h2>
                  {meeting.todos.length === 0 ? (
                    <p className="text-muted-foreground text-center py-12">{tDetail('actions.noActions')}</p>
                  ) : (
                    <div className="space-y-3">
                      {meeting.todos.map((todo) => (
                        <Card key={todo.id} className="hover:border-primary/40 transition-colors">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-base font-semibold text-foreground flex-1 leading-snug">
                                {todo.title}
                              </h3>
                              <div className="flex items-center gap-2 ml-3 shrink-0">
                                <span className={cn('text-xs font-medium', getConfidenceClass(todo.confidence))}>
                                  {getConfidenceLabel(todo.confidence)} ({Math.round(todo.confidence * 100)}%)
                                </span>
                                {todo.jiraSync?.status === 'synced' && (
                                  <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1 text-xs">
                                    <ExternalLink className="h-3 w-3" />
                                    {todo.jiraSync.jiraIssueKey}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground mb-3">{todo.description}</p>

                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-3">
                                {todo.assigneeHint && (
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    <span className="text-foreground">{todo.assigneeHint}</span>
                                  </span>
                                )}
                                <Badge variant="outline" className={cn(getStatusBadgeClass(todo.status))}>
                                  {tDetail(`actions.status.${todo.status}`)}
                                </Badge>
                              </div>
                              {todo.jiraSync?.status === 'failed' && (
                                <span className="flex items-center gap-1 text-destructive">
                                  <AlertTriangle className="h-3 w-3" />
                                  {tDetail('actions.jira.failed')}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </motion.div>
              </TabsContent>

              {/* Transcript */}
              <TabsContent value="transcript" className="pt-6">
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{tDetail('transcript.title')}</h2>
                  {meeting.transcript ? (
                    <div className="bg-muted/40 rounded-lg p-5 max-h-[32rem] overflow-y-auto">
                      <pre className="text-muted-foreground whitespace-pre-wrap font-mono text-sm leading-relaxed">
                        {meeting.transcript}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-12">{tDetail('transcript.noTranscript')}</p>
                  )}
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
