'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  ChevronDown,
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Info,
} from 'lucide-react'
import { MeetingPreparationResponse } from '@/types/meetings'
import { parseDecisionItems, type MeetingDecisionItem } from '@/lib/meetingDecisions'

type UiTodoStatus = 'open' | 'in_progress' | 'done'

interface MeetingDetailTodo {
  id: string
  title: string
  description: string
  assigneeHint: string | null
  confidence: number
  status: UiTodoStatus
  projectId: string | null
  project: {
    id: string
    name: string
    status: string
  } | null
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
  projectId: string | null
  project: {
    id: string
    name: string
    status: string
  } | null
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

interface ProjectOption {
  id: string
  name: string
  status: string
  archived: boolean
}

interface ProjectsApiResponse {
  projects: ProjectOption[]
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
      projectId: todo.projectId,
      project: todo.project,
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
  const [activeTab, setActiveTab] = useState('insights')
  const [preparation, setPreparation] = useState<MeetingPreparationResponse | null>(null)
  const [preparationLoading, setPreparationLoading] = useState(false)
  const [preparationError, setPreparationError] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectUpdateInFlightId, setProjectUpdateInFlightId] = useState<string | null>(null)
  const [projectUpdateError, setProjectUpdateError] = useState<string | null>(null)

  const meetingId = params.id as string

  const loadPreparation = useCallback(async () => {
    if (!meetingId || preparationLoading || preparation) return

    try {
      setPreparationLoading(true)
      setPreparationError(null)
      const response = await fetch(`/api/meetings/${meetingId}/preparation`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const payload = (await response.json()) as MeetingPreparationResponse
      setPreparation(payload)
    } catch {
      setPreparationError(tDetail('preparation.loadError'))
    } finally {
      setPreparationLoading(false)
    }
  }, [meetingId, preparationLoading, preparation, tDetail])

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

  useEffect(() => {
    if (activeTab === 'preparation') {
      void loadPreparation()
    }
  }, [activeTab, loadPreparation])

  useEffect(() => {
    let active = true

    const loadProjects = async () => {
      try {
        setProjectsLoading(true)
        const response = await fetch('/api/projects', { cache: 'no-store' })
        if (!response.ok) throw new Error(`Failed with status ${response.status}`)
        const payload = (await response.json()) as ProjectsApiResponse
        if (active) {
          setProjects((payload.projects || []).filter((project) => !project.archived && project.status === 'active'))
        }
      } catch {
        if (active) {
          setProjects([])
        }
      } finally {
        if (active) {
          setProjectsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      active = false
    }
  }, [])

  const updateTodoProject = useCallback(
    async (todoId: string, nextProjectId: string | null) => {
      try {
        setProjectUpdateError(null)
        setProjectUpdateInFlightId(todoId)

        const response = await fetch(`/api/todos/${todoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: nextProjectId }),
        })

        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`)
        }

        setMeeting((current) => {
          if (!current) return current
          return {
            ...current,
            todos: current.todos.map((todo) => {
              if (todo.id !== todoId) return todo
              const assignedProject = projects.find((project) => project.id === nextProjectId) ?? null
              return {
                ...todo,
                projectId: nextProjectId,
                project: assignedProject
                  ? {
                      id: assignedProject.id,
                      name: assignedProject.name,
                      status: assignedProject.status,
                    }
                  : null,
              }
            }),
          }
        })
      } catch {
        setProjectUpdateError(tDetail('actions.project.updateError'))
      } finally {
        setProjectUpdateInFlightId(null)
      }
    },
    [projects, tDetail]
  )

  const decisions = useMemo<MeetingDecisionItem[]>(() => {
    if (!meeting?.decisions) return []
    return parseDecisionItems(meeting.decisions)
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

  const buildSourceTooltip = (item?: {
    matchedTerms: string[]
    matchScore: number
    freshnessScore: number
  }) => {
    if (!item) {
      return tDetail('preparation.scoreTooltip', {
        matchTerms: tDetail('preparation.noMatchTerms'),
        matchScore: 0,
        freshnessScore: 0,
      })
    }

    return tDetail('preparation.scoreTooltip', {
      matchTerms: item.matchedTerms.length > 0 ? item.matchedTerms.join(', ') : tDetail('preparation.noMatchTerms'),
      matchScore: item.matchScore,
      freshnessScore: item.freshnessScore,
    })
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-col w-full">
              <TabsList className="border-b border-border rounded-none bg-transparent w-full justify-start gap-1 h-auto pb-0 mb-0">
                <TabsTrigger
                  value="insights"
                  className="rounded-none border-b-2 border-transparent data-active:border-primary data-active:text-primary data-active:bg-transparent pb-2 px-4 text-sm font-medium text-muted-foreground data-active:text-foreground"
                >
                  {tDetail('tabs.insights')}
                </TabsTrigger>
                <TabsTrigger
                  value="preparation"
                  onClick={() => { void loadPreparation() }}
                  className="rounded-none border-b-2 border-transparent data-active:border-primary data-active:text-primary data-active:bg-transparent pb-2 px-4 text-sm font-medium text-muted-foreground data-active:text-foreground"
                >
                  {tDetail('tabs.preparation')}
                </TabsTrigger>
                <TabsTrigger
                  value="transcript"
                  className="rounded-none border-b-2 border-transparent data-active:border-primary data-active:text-primary data-active:bg-transparent pb-2 px-4 text-sm font-medium text-muted-foreground data-active:text-foreground"
                >
                  {tDetail('tabs.transcript')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preparation" className="pt-6">
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      {tDetail('preparation.title')}
                    </h2>
                    <Link href={`/meetings/${meeting.id}/preparation`} className="text-xs text-primary hover:text-primary/80">
                      {tDetail('preparation.openFullPage')} →
                    </Link>
                  </div>

                  {preparationLoading && (
                    <p className="text-sm text-muted-foreground">{tCommon('labels.loading')}</p>
                  )}

                  {!preparationLoading && preparationError && (
                    <p className="text-sm text-destructive">{preparationError}</p>
                  )}

                  {!preparationLoading && !preparationError && preparation && (
                    <div className="space-y-4">
                      <Card>
                        <CardContent className="p-4 space-y-2">
                          <p className="text-sm font-medium text-foreground">{tDetail('preparation.statusTitle')}</p>
                          <p className="text-xs text-muted-foreground">{tDetail(`preparation.status.${preparation.prepStatus.level}`)}</p>
                          {preparation.prepStatus.reasons.length > 0 && (
                            <ul className="space-y-1">
                              {preparation.prepStatus.reasons.slice(0, 3).map((reason, index) => (
                                <li key={`prep-reason-${index}`} className="text-xs text-muted-foreground">• {reason}</li>
                              ))}
                            </ul>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {tDetail('preparation.cadence')}: {tDetail(`preparation.cadenceType.${preparation.cadence.type}`)}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm font-medium text-foreground mb-2">{tDetail('preparation.agendaTitle')}</p>
                          {preparation.preparedAgenda.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{tDetail('preparation.noAgenda')}</p>
                          ) : (
                            <ul className="space-y-1">
                              {preparation.preparedAgenda.slice(0, 6).map((item, index) => (
                                <li key={`prep-agenda-${index}`} className="text-xs text-muted-foreground">• {item.title}</li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>

                      <div className="grid md:grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-foreground mb-2">{tDetail('preparation.longRunningTitle')}</p>
                            {preparation.longRunningTasks.length === 0 ? (
                              <p className="text-xs text-muted-foreground">{tDetail('preparation.noLongRunning')}</p>
                            ) : (
                              <ul className="space-y-1">
                                {preparation.longRunningTasks.slice(0, 5).map((task, index) => (
                                  <li key={`prep-long-${index}`} className="text-xs text-muted-foreground">
                                    • {task.title} ({task.ageDays}d)
                                  </li>
                                ))}
                              </ul>
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-foreground mb-2">{tDetail('preparation.carryOverTitle')}</p>
                            {preparation.carryOverTopics.length === 0 ? (
                              <p className="text-xs text-muted-foreground">{tDetail('preparation.noCarryOver')}</p>
                            ) : (
                              <ul className="space-y-1">
                                {preparation.carryOverTopics.slice(0, 5).map((topic, index) => (
                                  <li key={`prep-carry-${index}`} className="text-xs text-muted-foreground">
                                    • {topic.title} ({topic.occurrences}x)
                                  </li>
                                ))}
                              </ul>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm font-medium text-foreground mb-2">{tDetail('preparation.sourcesTitle')}</p>
                          {preparation.projectSourceResults.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{tDetail('preparation.noSources')}</p>
                          ) : (
                            <div className="space-y-3">
                              {preparation.projectSourceResults.slice(0, 4).map((result, index) => (
                                <div key={`prep-source-${index}`} className="rounded-md border border-border p-2 bg-muted/20">
                                  <p className="text-[11px] text-muted-foreground mb-1">
                                    {result.projectName} · {result.sourceType} ·
                                    <span className="inline-flex items-center gap-1 ml-1">
                                      <span>{tDetail('preparation.scoreLabel', { score: result.score })}</span>
                                      <span title={buildSourceTooltip(result.items[0])} aria-label={buildSourceTooltip(result.items[0])}>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                      </span>
                                    </span>
                                  </p>
                                  {result.items.slice(0, 2).map((item, itemIndex) => (
                                    <div key={`prep-source-item-${index}-${itemIndex}`} className="text-xs inline-flex items-center gap-1.5">
                                      <a href={item.url} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80">
                                        {item.title}
                                      </a>
                                      <span className="text-muted-foreground">{tDetail('preparation.scoreLabel', { score: item.score })}</span>
                                      <span title={buildSourceTooltip(item)} aria-label={buildSourceTooltip(item)}>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </motion.div>
              </TabsContent>

              {/* Insights */}
              <TabsContent value="insights" className="pt-6">
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <section className="mb-4">
                    <h2 className="text-lg font-semibold text-foreground mb-3">{tDetail('summary.title')}</h2>
                    {meeting.summary ? (
                      <p className="text-muted-foreground leading-relaxed">{meeting.summary}</p>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">—</p>
                    )}
                  </section>

                  <details open className="group mb-4 rounded-lg border border-border bg-muted/20">
                    <summary className="list-none cursor-pointer flex items-center justify-between gap-3 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <span className="text-base font-semibold text-foreground">
                        {tDetail('decisions.title')}
                        <span className="ml-1.5 text-xs text-muted-foreground">({decisions.length})</span>
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 pt-1">
                      {decisions.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{tDetail('decisions.noDecisions')}</p>
                      ) : (
                        <ul className="space-y-2">
                          {decisions.map((decision, index) => (
                            <li key={index} className="bg-background rounded-lg border border-border/70 p-4">
                              <div className="flex items-start gap-3">
                                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{decision.topic}</span>
                              </div>
                              {(decision.rationale || decision.quote) && (
                                <details className="group mt-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                                  <summary className="list-none cursor-pointer flex items-center justify-between gap-3 text-xs text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                    <span>{tDetail('decisions.whyIdentified')}</span>
                                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                                  </summary>
                                  <div className="mt-2 space-y-2">
                                    {decision.rationale && (
                                      <p className="text-sm text-foreground/90">{decision.rationale}</p>
                                    )}
                                    {decision.quote && (
                                      <blockquote className="border-l-2 border-primary/40 pl-3 text-xs text-muted-foreground italic">
                                        "{decision.quote}"
                                      </blockquote>
                                    )}
                                  </div>
                                </details>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>

                  <details open className="group rounded-lg border border-border bg-muted/20">
                    <summary className="list-none cursor-pointer flex items-center justify-between gap-3 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <span className="text-base font-semibold text-foreground">
                        {tDetail('actions.title')}
                        <span className="ml-1.5 text-xs text-muted-foreground">({meeting.todos.length})</span>
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 pt-1">
                      {projectUpdateError && (
                        <p className="text-sm text-destructive mb-3">{projectUpdateError}</p>
                      )}
                      {meeting.todos.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{tDetail('actions.noActions')}</p>
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

                                <div className="mb-3">
                                  <label className="block text-xs text-muted-foreground mb-1">
                                    {tDetail('actions.project.label')}
                                  </label>
                                  <select
                                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={todo.projectId ?? ''}
                                    disabled={projectsLoading || projectUpdateInFlightId === todo.id}
                                    onChange={(event) => {
                                      const value = event.target.value
                                      void updateTodoProject(todo.id, value.length > 0 ? value : null)
                                    }}
                                  >
                                    <option value="">{tDetail('actions.project.unassigned')}</option>
                                    {projects.map((project) => (
                                      <option key={project.id} value={project.id}>
                                        {project.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

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
                    </div>
                  </details>
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
