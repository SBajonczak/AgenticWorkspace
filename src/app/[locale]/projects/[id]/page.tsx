'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  User,
  Users,
  Calendar,
  ChevronLeft,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Loader2,
  BookOpen,
  ListTodo,
  Link as LinkIcon,
  UserPlus,
  Trash2,
}  from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectAlias {
  id: string
  alias: string
}

interface ProjectSourceLink {
  id: string
  type: string
  label: string | null
  identifier: string
}

interface ProjectData {
  id: string
  name: string
  description: string | null
  status: string
  owner: string | null
  archived: boolean
  confirmed: boolean
  aliases: ProjectAlias[]
  sourceLinks: ProjectSourceLink[]
}

interface OpenTodoEntry {
  id: string
  title: string
  assigneeHint: string | null
  status: string
  priority: string | null
  dueDate: string | null
}

interface MeetingEntry {
  id: string
  meetingId: string
  title: string
  organizer: string
  startTime: string
  endTime: string
  processedAt: string | null
  projectStatus: { status: string; summary: string }
  decisions: string[]
  openTodos: OpenTodoEntry[]
}

interface KbDecision {
  text: string
  meetingId: string
  meetingTitle: string
  date: string
}

interface KbTodo extends OpenTodoEntry {
  meetingId: string
  meetingTitle: string
}

interface Stats {
  totalMeetings: number
  totalTodos: number
  openTodos: number
  totalDecisions: number
}

interface ContextResponse {
  project: ProjectData
  meetings: MeetingEntry[]
  stats: Stats
  knowledgeBase: {
    recentDecisions: KbDecision[]
    openTodos: KbTodo[]
  }
}

interface ProjectMember {
  id: string
  userId: string
  oid: string
  tid: string
  displayName: string
  email: string | null
  role: string
}

interface ProjectMembersResponse {
  canManage: boolean
  owner: {
    oid: string | null
    tid: string | null
    name: string | null
  }
  members: ProjectMember[]
}

interface UserSearchEntry {
  userId: string | null
  oid: string
  tid: string
  displayName: string
  email: string | null
  source: 'local' | 'graph'
  canAssign: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string) {
  switch (status) {
    case 'active':    return 'border-green-500/30 bg-green-500/20 text-green-400'
    case 'on_hold':   return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
    case 'completed': return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
    case 'archived':  return 'border-gray-500/30 bg-gray-500/20 text-gray-400'
    default:          return 'border-gray-500/30 bg-gray-500/20 text-gray-400'
  }
}

function projectStatusBadgeClass(status: string) {
  switch (status) {
    case 'on_track':  return 'border-green-500/30 bg-green-500/20 text-green-400'
    case 'at_risk':   return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
    case 'blocked':   return 'border-red-500/30 bg-red-500/20 text-red-400'
    default:          return 'border-gray-500/30 bg-gray-500/20 text-gray-400'
  }
}

function priorityBadgeClass(priority: string | null) {
  switch (priority) {
    case 'high':   return 'border-red-500/30 bg-red-500/20 text-red-400'
    case 'medium': return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400'
    case 'low':    return 'border-green-500/30 bg-green-500/20 text-green-400'
    default:       return 'border-gray-500/30 bg-gray-500/20 text-gray-400'
  }
}

function todoStatusBadgeClass(status: string) {
  switch (status) {
    case 'done':        return 'border-green-500/30 bg-green-500/20 text-green-400'
    case 'in_progress': return 'border-blue-500/30 bg-blue-500/20 text-blue-400'
    default:            return 'border-gray-500/30 bg-gray-500/20 text-gray-400'
  }
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params.id as string
  const tDetail = useTranslations('projects.detail')

  const [data, setData] = useState<ContextResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [todoStatusMap, setTodoStatusMap] = useState<Record<string, string>>({})
  const [todoMarkingSet, setTodoMarkingSet] = useState<Set<string>>(new Set())
  const [membersData, setMembersData] = useState<ProjectMembersResponse | null>(null)
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberActionLoading, setMemberActionLoading] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [searchResults, setSearchResults] = useState<UserSearchEntry[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/projects/${id}/context`, { cache: 'no-store' })
      if (res.status === 404) { setLoadError('not_found'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch {
      setLoadError('error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    setMemberError(null)
    try {
      const res = await fetch(`/api/projects/${id}/members`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setMembersData(await res.json())
    } catch {
      setMemberError(tDetail('team.loadError'))
    } finally {
      setMembersLoading(false)
    }
  }, [id, tDetail])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  useEffect(() => {
    const trimmed = searchQuery.trim()
    const timeout = setTimeout(async () => {
      if (!membersData?.canManage) return

      try {
        setSearchingUsers(true)
        const query = trimmed.length > 0 ? `?q=${encodeURIComponent(trimmed)}` : ''
        const res = await fetch(`/api/tenants/users${query}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const payload = (await res.json()) as { users?: UserSearchEntry[] }
        setSearchResults(payload.users ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchingUsers(false)
      }
    }, 250)

    return () => clearTimeout(timeout)
  }, [searchQuery, membersData?.canManage])

  const addMember = async (candidate: UserSearchEntry) => {
    if (!candidate.userId) return
    setMemberActionLoading(true)
    setMemberError(null)
    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: candidate.userId }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'failed')
      }

      setSearchQuery('')
      setSearchResults([])
      await loadMembers()
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : tDetail('team.addError'))
    } finally {
      setMemberActionLoading(false)
    }
  }

  const removeMember = async (member: ProjectMember) => {
    setMemberActionLoading(true)
    setMemberError(null)
    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberOid: member.oid, memberTid: member.tid }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'failed')
      }

      await loadMembers()
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : tDetail('team.removeError'))
    } finally {
      setMemberActionLoading(false)
    }
  }

  const confirmProject = async () => {
    if (!data) return
    setConfirming(true)
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      })
      if (res.ok) {
        setData((prev) => prev ? { ...prev, project: { ...prev.project, confirmed: true } } : prev)
      }
    } finally {
      setConfirming(false)
    }
  }

  const handleMarkTodoDone = async (todoId: string) => {
    setTodoMarkingSet((prev) => new Set(prev).add(todoId))
    setTodoStatusMap((prev) => ({ ...prev, [todoId]: 'done' }))
    try {
      await fetch(`/api/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })
    } catch {
      setTodoStatusMap((prev) => {
        const next = { ...prev }
        delete next[todoId]
        return next
      })
    } finally {
      setTodoMarkingSet((prev) => {
        const next = new Set(prev)
        next.delete(todoId)
        return next
      })
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader activeLink="projects" />
        <main className="container mx-auto px-4 py-12">
          <Skeleton className="h-6 w-32 mb-8" />
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-5 w-96 mb-8" />
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-8 w-80 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </main>
      </div>
    )
  }

  // Error / not-found state
  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground text-2xl mb-4">
            {loadError === 'not_found' ? tDetail('notFound') : 'Something went wrong'}
          </p>
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80">
            <ChevronLeft className="h-4 w-4" /> {tDetail('backToList')}
          </Link>
        </div>
      </div>
    )
  }

  const { project, meetings, stats, knowledgeBase } = data

  // Flatten all open todos across all meetings for the Tasks tab
  const allTodos = meetings.flatMap((m) =>
    m.openTodos.map((t) => ({ ...t, meetingId: m.id, meetingTitle: m.title }))
  )

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="projects" />

      <main className="container mx-auto px-4 py-12">
        {/* Back link + header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/projects" className="text-primary hover:text-primary/80 mb-4 inline-flex items-center gap-1.5 text-sm">
            <ChevronLeft className="h-4 w-4" /> {tDetail('backToList')}
          </Link>

          {/* Unconfirmed banner */}
          {!project.confirmed && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-300">{tDetail('confirmed.banner')}</p>
              </div>
              <Button size="sm" variant="outline" onClick={confirmProject} disabled={confirming}
                className="shrink-0 border-amber-500/50 text-amber-300 hover:bg-amber-500/20">
                {confirming
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />{tDetail('confirmed.confirming')}</>
                  : <><CheckCircle className="h-3.5 w-3.5 mr-1" />{tDetail('confirmed.action')}</>
                }
              </Button>
            </div>
          )}

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}
            </div>
            <Badge variant="outline" className={cn('ml-4 shrink-0', statusBadgeClass(project.status))}>
              {tDetail(`status.${project.status}` as Parameters<typeof tDetail>[0])}
            </Badge>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-8 grid grid-cols-3 gap-4"
        >
          {[
            { label: tDetail('stats.meetings'), value: stats.totalMeetings },
            { label: tDetail('stats.todos'), value: stats.openTodos },
            { label: tDetail('stats.decisions'), value: stats.totalDecisions },
          ].map(({ label, value }) => (
            <Card key={label} className="backdrop-blur">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Tabs defaultValue="overview" className="flex-col w-full">
            <TabsList className="border-b border-border rounded-none bg-transparent w-full justify-start gap-1 h-auto pb-0 mb-6">
              {(['overview', 'team', 'meetings', 'tasks', 'knowledge'] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-none border-b-2 border-transparent data-active:border-primary data-active:text-primary data-active:bg-transparent pb-2 px-4 text-sm font-medium text-muted-foreground data-active:text-foreground"
                >
                  {tDetail(`tabs.${tab}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Overview ── */}
            <TabsContent value="overview">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <Card className="backdrop-blur rounded-xl">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('overview.title')}</h3>
                    <dl className="space-y-3">
                      {project.owner && (
                        <div className="flex gap-3">
                          <dt className="text-sm text-muted-foreground w-24 shrink-0">{tDetail('overview.metadata.owner')}</dt>
                          <dd className="text-sm text-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {project.owner}</dd>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <dt className="text-sm text-muted-foreground w-24 shrink-0">{tDetail('overview.metadata.status')}</dt>
                        <dd>
                          <Badge variant="outline" className={cn('text-xs', statusBadgeClass(project.status))}>
                            {tDetail(`status.${project.status}` as Parameters<typeof tDetail>[0])}
                          </Badge>
                        </dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="text-sm text-muted-foreground w-24 shrink-0">{tDetail('overview.description')}</dt>
                        <dd className="text-sm text-foreground">{project.description || <span className="text-muted-foreground italic">{tDetail('overview.noDescription')}</span>}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {project.aliases.length > 0 && (
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-foreground mb-3">{tDetail('overview.aliases')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {project.aliases.map((a) => (
                          <span key={a.id} className="rounded-md bg-muted px-2.5 py-1 text-sm text-muted-foreground">{a.alias}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {project.sourceLinks.length > 0 && (
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-foreground mb-3">{tDetail('overview.sources')}</h3>
                      <div className="space-y-2">
                        {project.sourceLinks.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <Badge variant="outline" className="text-xs capitalize shrink-0">{s.type}</Badge>
                            <span className="text-sm text-muted-foreground truncate">{s.label || s.identifier}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </TabsContent>

            {/* ── Team ── */}
            <TabsContent value="team">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <Card className="backdrop-blur rounded-xl">
                  <CardContent className="p-6 space-y-3">
                    <h3 className="text-lg font-bold text-foreground">{tDetail('team.title')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {tDetail('team.ownerLabel')}: {membersData?.owner.name ?? tDetail('team.ownerUnknown')}
                    </p>
                    <p className="text-xs text-muted-foreground">{tDetail('team.graphHint')}</p>
                  </CardContent>
                </Card>

                {membersData?.canManage && (
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-6 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <UserPlus className="h-4 w-4" />
                        {tDetail('team.addTitle')}
                      </div>
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={tDetail('team.searchPlaceholder')}
                        className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      {searchingUsers && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {tDetail('team.searching')}
                        </div>
                      )}
                      {!searchingUsers && searchResults.length > 0 && (
                        <div className="space-y-2">
                          {searchResults.map((candidate) => (
                            <div key={`${candidate.tid}:${candidate.oid}`} className="flex items-center justify-between rounded-lg border border-border p-3">
                              <div className="min-w-0">
                                <p className="text-sm text-foreground truncate">{candidate.displayName}</p>
                                <p className="text-xs text-muted-foreground truncate">{candidate.email ?? candidate.oid}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!candidate.canAssign || memberActionLoading}
                                onClick={() => addMember(candidate)}
                              >
                                {candidate.canAssign ? tDetail('team.addAction') : tDetail('team.notAssignable')}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card className="backdrop-blur rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
                      <Users className="h-4 w-4" />
                      {tDetail('team.membersTitle')}
                    </div>
                    {membersLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {tDetail('team.loading')}
                      </div>
                    ) : membersData && membersData.members.length > 0 ? (
                      <div className="space-y-2">
                        {membersData.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div className="min-w-0">
                              <p className="text-sm text-foreground truncate">{member.displayName}</p>
                              <p className="text-xs text-muted-foreground truncate">{member.email ?? `${member.tid}:${member.oid}`}</p>
                            </div>
                            {membersData.canManage && (
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={memberActionLoading}
                                onClick={() => removeMember(member)}
                                aria-label={tDetail('team.removeAction')}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{tDetail('team.empty')}</p>
                    )}
                    {memberError && <p className="text-xs text-destructive mt-3">{memberError}</p>}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* ── Meetings ── */}
            <TabsContent value="meetings">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('meetings.title')}</h3>
                {meetings.length === 0 ? (
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">{tDetail('meetings.noMeetings')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {meetings.map((m) => (
                      <Card key={m.id} className="backdrop-blur rounded-xl hover:border-primary/30 transition-all">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground truncate">{m.title}</h4>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {m.organizer}</span>
                                <span>·</span>
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(m.startTime).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className={cn('text-xs', projectStatusBadgeClass(m.projectStatus.status))}>
                                {m.projectStatus.status.replace('_', ' ')}
                              </Badge>
                              <Link href={`/meetings/${m.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2">
                                  {tDetail('meetings.view')} <ArrowRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            </div>
                          </div>

                          {m.projectStatus.summary && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{m.projectStatus.summary}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{m.decisions.length} {tDetail('meetings.decisions')}</span>
                            <span>·</span>
                            <span>{m.openTodos.length} {tDetail('meetings.openTodos')}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* ── Tasks ── */}
            <TabsContent value="tasks">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('tasks.title')}</h3>
                {allTodos.length === 0 ? (
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-8 text-center">
                      <ListTodo className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">{tDetail('tasks.noTasks')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {allTodos.map((t) => {
                      const effectiveStatus = todoStatusMap[t.id] ?? t.status
                      const isDone = effectiveStatus === 'done'
                      return (
                      <Card key={t.id} className={cn('backdrop-blur rounded-xl', isDone && 'opacity-60')}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-medium text-foreground', isDone && 'line-through text-muted-foreground')}>{t.title}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                                {t.assigneeHint && (
                                  <>
                                    <User className="h-3 w-3" />
                                    <span>{t.assigneeHint}</span>
                                    <span>·</span>
                                  </>
                                )}
                                <span>{tDetail('tasks.from')} </span>
                                <Link href={`/meetings/${t.meetingId}`} className="text-primary hover:text-primary/80 truncate max-w-48">
                                  {t.meetingTitle}
                                </Link>
                                {t.dueDate && (
                                  <>
                                    <span>·</span>
                                    <Calendar className="h-3 w-3" />
                                    <span>{new Date(t.dueDate).toLocaleDateString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {t.priority && (
                                <Badge variant="outline" className={cn('text-xs', priorityBadgeClass(t.priority))}>
                                  {tDetail(`tasks.priority.${t.priority}` as Parameters<typeof tDetail>[0])}
                                </Badge>
                              )}
                              <Badge variant="outline" className={cn('text-xs capitalize', todoStatusBadgeClass(effectiveStatus))}>
                                {tDetail(`tasks.statusLabel.${effectiveStatus}` as Parameters<typeof tDetail>[0]) ?? effectiveStatus}
                              </Badge>
                              {!isDone && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={todoMarkingSet.has(t.id)}
                                  onClick={() => handleMarkTodoDone(t.id)}
                                  className="gap-1 text-xs h-7"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  {tDetail('tasks.markDone')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* ── Knowledge Base ── */}
            <TabsContent value="knowledge">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                {knowledgeBase.recentDecisions.length === 0 && knowledgeBase.openTodos.length === 0 ? (
                  <Card className="backdrop-blur rounded-xl">
                    <CardContent className="p-8 text-center">
                      <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">{tDetail('knowledge.noData')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {knowledgeBase.openTodos.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('knowledge.openItems')}</h3>
                        <div className="space-y-3">
                          {knowledgeBase.openTodos.map((t) => (
                            <Card key={t.id} className="backdrop-blur rounded-xl">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                      {t.assigneeHint && <span>{t.assigneeHint} ·</span>}
                                      <span>{tDetail('knowledge.fromMeeting')} </span>
                                      <Link href={`/meetings/${t.meetingId}`} className="text-primary hover:text-primary/80 truncate max-w-48">
                                        {t.meetingTitle}
                                      </Link>
                                    </div>
                                  </div>
                                  {t.priority && (
                                    <Badge variant="outline" className={cn('text-xs shrink-0', priorityBadgeClass(t.priority))}>
                                      {tDetail(`tasks.priority.${t.priority}` as Parameters<typeof tDetail>[0])}
                                    </Badge>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {knowledgeBase.recentDecisions.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-4">{tDetail('knowledge.decisions')}</h3>
                        <div className="space-y-3">
                          {knowledgeBase.recentDecisions.map((d, i) => (
                            <Card key={i} className="backdrop-blur rounded-xl border-l-4 border-l-primary/40">
                              <CardContent className="p-4">
                                <p className="text-sm text-foreground mb-2">{d.text}</p>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                                  <span>{tDetail('knowledge.fromMeeting')} </span>
                                  <Link href={`/meetings/${d.meetingId}`} className="text-primary hover:text-primary/80 truncate max-w-64">
                                    {d.meetingTitle}
                                  </Link>
                                  <span>·</span>
                                  <Calendar className="h-3 w-3" />
                                  <span>{new Date(d.date).toLocaleDateString()}</span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  )
}
