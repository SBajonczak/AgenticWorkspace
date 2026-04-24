'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ShieldCheck, RefreshCw, Database, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckpointState {
  tenantId: string
  meetingSyncCheckpointAt: string | null
  checkpointUpdatedAt: string | null
  checkpointUpdatedByUserId: string | null
  checkpointUpdatedByEmail: string | null
  checkpointUpdateReason: string | null
  maxBackfillDays: number
}

interface IndexedMeeting {
  id: string
  meetingId: string
  source: 'imported' | 'graph' | 'imported+graph'
  title: string
  startTime: string
  endTime: string
  organizer: string
  organizerEmail: string | null
  participants: string | null
  indexedAt: string | null
  indexedForUserId: string | null
  indexedForUserEmail: string | null
  indexedByUserId: string | null
  indexedByUserEmail: string | null
  processedAt: string | null
  recrawlCount: number
  lastRecrawlAt: string | null
  hasTranscript: boolean
  hasAnalysis: boolean
  isIndexing: boolean
  indexingStartedAt: string | null
  graphLastModifiedAt: string | null
}

type TabKey = 'checkpoint' | 'meetings'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border', ok ? 'border-green-500/30 bg-green-500/10 text-green-500' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500')}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {ok ? 'Verarbeitet' : 'Ausstehend'}
    </span>
  )
}

function SourceBadge({ source }: { source: IndexedMeeting['source'] }) {
  if (source === 'imported+graph') {
    return <Badge variant="secondary">Graph + Import</Badge>
  }
  if (source === 'graph') {
    return <Badge variant="outline">Graph</Badge>
  }
  return <Badge variant="secondary">Import</Badge>
}

// ---------------------------------------------------------------------------
// Checkpoint Tab
// ---------------------------------------------------------------------------

function CheckpointTab({ t, checkpoint, onRefresh }: { t: ReturnType<typeof useTranslations>; checkpoint: CheckpointState | null; onRefresh: () => void }) {
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backfillMsg, setBackfillMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const maxDays = checkpoint?.maxBackfillDays ?? 30

  const handleSetCheckpoint = async () => {
    if (!date.trim()) return

    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) {
      setMsg({ type: 'error', text: t('worker.checkpoint.validationInvalid') })
      return
    }
    if (parsed > new Date()) {
      setMsg({ type: 'error', text: t('worker.checkpoint.validationFuture') })
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/worker/checkpoint', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason: reason || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg({ type: 'success', text: t('worker.checkpoint.successSet') })
        setDate('')
        setReason('')
        onRefresh()
      } else {
        setMsg({ type: 'error', text: data.error ?? t('worker.checkpoint.error') })
      }
    } catch {
      setMsg({ type: 'error', text: t('worker.checkpoint.error') })
    } finally {
      setSaving(false)
    }
  }

  const handleClearCheckpoint = async () => {
    if (!window.confirm(t('worker.checkpoint.clearConfirm'))) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/worker/checkpoint', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: null, reason: 'admin-cleared' }),
      })
      if (res.ok) {
        setMsg({ type: 'success', text: t('worker.checkpoint.successClear') })
        onRefresh()
      } else {
        setMsg({ type: 'error', text: t('worker.checkpoint.error') })
      }
    } catch {
      setMsg({ type: 'error', text: t('worker.checkpoint.error') })
    } finally {
      setSaving(false)
    }
  }

  const handleBackfill = async (dryRun: boolean) => {
    if (!fromDate.trim()) {
      setBackfillMsg({ type: 'error', text: t('worker.backfill.validationFrom') })
      return
    }

    setRunning(true)
    setBackfillMsg(null)
    try {
      const res = await fetch('/api/admin/worker/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromDate, to: toDate || undefined, dryRun }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const successText = dryRun
          ? t('worker.backfill.dryRunSuccess')
          : t('worker.backfill.success').replace('{count}', String(data.usersProcessed ?? 0))
        setBackfillMsg({ type: 'success', text: successText })
        if (!dryRun) onRefresh()
      } else {
        setBackfillMsg({ type: 'error', text: data.error ?? t('worker.backfill.error') })
      }
    } catch {
      setBackfillMsg({ type: 'error', text: t('worker.backfill.error') })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Current state */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('worker.checkpoint.title')}</CardTitle>
          <CardDescription>{t('worker.checkpoint.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {checkpoint ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('worker.checkpoint.current')}</dt>
                <dd className="font-mono font-medium mt-0.5">
                  {checkpoint.meetingSyncCheckpointAt ? formatDateTime(checkpoint.meetingSyncCheckpointAt) : <span className="text-muted-foreground">{t('worker.checkpoint.none')}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('worker.checkpoint.updatedAt')}</dt>
                <dd className="mt-0.5">{formatDateTime(checkpoint.checkpointUpdatedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('worker.checkpoint.updatedBy')}</dt>
                <dd className="mt-0.5">{checkpoint.checkpointUpdatedByEmail ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('worker.checkpoint.reason')}</dt>
                <dd className="mt-0.5">{checkpoint.checkpointUpdateReason ?? '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t('worker.checkpoint.none')}</p>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            {t('worker.checkpoint.maxBackfillHint').replace('{days}', String(maxDays))}
          </p>
        </CardContent>
      </Card>

      {/* Set/clear checkpoint */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('worker.checkpoint.fieldDate')}</label>
            <Input
              placeholder={t('worker.checkpoint.fieldDatePlaceholder')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('worker.checkpoint.fieldReason')}</label>
            <Input
              placeholder={t('worker.checkpoint.fieldReasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {msg && (
            <div className={cn('text-sm px-3 py-2 rounded-md border', msg.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
              {msg.text}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSetCheckpoint} disabled={saving || !date.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('worker.checkpoint.buttonSet')}
            </Button>
            {checkpoint?.meetingSyncCheckpointAt && (
              <Button variant="outline" onClick={handleClearCheckpoint} disabled={saving}>
                {t('worker.checkpoint.buttonClear')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backfill */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('worker.backfill.title')}</CardTitle>
          <CardDescription>{t('worker.backfill.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('worker.backfill.fieldFrom')}</label>
              <Input placeholder={t('worker.backfill.fieldFromPlaceholder')} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('worker.backfill.fieldTo')}</label>
              <Input placeholder={t('worker.backfill.fieldToPlaceholder')} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          {backfillMsg && (
            <div className={cn('text-sm px-3 py-2 rounded-md border', backfillMsg.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
              {backfillMsg.text}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => handleBackfill(false)} disabled={running || !fromDate.trim()}>
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('worker.backfill.buttonRun')}
            </Button>
            <Button variant="outline" onClick={() => handleBackfill(true)} disabled={running || !fromDate.trim()}>
              {t('worker.backfill.buttonDryRun')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Meetings Audit Tab
// ---------------------------------------------------------------------------

function MeetingsTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [meetings, setMeetings] = useState<IndexedMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterUser, setFilterUser] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [recrawling, setRecrawling] = useState<string | null>(null)
  const [recrawlMsg, setRecrawlMsg] = useState<{ type: 'success' | 'error'; id: string; text: string } | null>(null)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterUser.trim()) params.set('userId', filterUser.trim())
      if (filterFrom.trim()) params.set('from', filterFrom.trim())
      if (filterTo.trim()) params.set('to', filterTo.trim())
      params.set('includeGraph', '1')
      params.set('graphLimit', '80')
      params.set('withTranscriptProbe', '1')
      const res = await fetch(`/api/admin/worker/meetings?${params.toString()}`)
      if (!res.ok) {
        setError(t('worker.meetings.error'))
        return
      }
      const data = await res.json()
      setMeetings(data.meetings ?? [])
    } catch {
      setError(t('worker.meetings.error'))
    } finally {
      setLoading(false)
    }
  }, [filterUser, filterFrom, filterTo, t])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const handleRecrawl = async (meeting: IndexedMeeting) => {
    const isForce = meeting.hasAnalysis
    const confirmationText = isForce
      ? t('worker.meetings.forceAnalyzeConfirm').replace('{title}', meeting.title)
      : t('worker.meetings.analyzeConfirm').replace('{title}', meeting.title)
    const confirmed = window.confirm(confirmationText)
    if (!confirmed) return

    setRecrawling(meeting.id)
    setRecrawlMsg(null)
    try {
      let participants: string[] = []
      if (meeting.participants) {
        try {
          participants = JSON.parse(meeting.participants) as string[]
        } catch {
          participants = []
        }
      }

      const res = await fetch('/api/admin/worker/meetings/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: meeting.indexedForUserId,
          meetingId: meeting.meetingId,
          title: meeting.title,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          organizer: meeting.organizer,
          organizerEmail: meeting.organizerEmail,
          participants,
          force: isForce,
        }),
      })
      if (res.ok) {
        setRecrawlMsg({
          type: 'success',
          id: meeting.id,
          text: isForce ? t('worker.meetings.forceAnalyzeSuccess') : t('worker.meetings.analyzeSuccess'),
        })
        fetchMeetings()
      } else {
        const data = await res.json().catch(() => ({}))
        setRecrawlMsg({
          type: 'error',
          id: meeting.id,
          text: data.error ?? (isForce ? t('worker.meetings.forceAnalyzeError') : t('worker.meetings.analyzeError')),
        })
      }
    } catch {
      setRecrawlMsg({
        type: 'error',
        id: meeting.id,
        text: meeting.hasAnalysis ? t('worker.meetings.forceAnalyzeError') : t('worker.meetings.analyzeError'),
      })
    } finally {
      setRecrawling(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('worker.meetings.filterUser')}</label>
              <Input
                placeholder="User-ID oder E-Mail"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('worker.meetings.filterFrom')}</label>
              <Input placeholder="ISO 8601" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('worker.meetings.filterTo')}</label>
              <Input placeholder="ISO 8601" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={fetchMeetings} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {t('worker.meetings.buttonFilter')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFilterUser(''); setFilterFrom(''); setFilterTo('') }}>
              {t('worker.meetings.buttonReset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {error && (
        <div className="text-sm text-destructive flex items-center gap-2 px-1">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t('worker.meetings.loading')}</span>
        </div>
      )}

      {!loading && !error && meetings.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">{t('worker.meetings.noMeetings')}</p>
      )}

      {!loading && meetings.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.title')}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.source')}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.startTime')}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.indexedForUser')}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.indexedByUser')}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.indexedAt')}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.processedAt')}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.recrawlCount')}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.transcript')}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('worker.meetings.columns.analysis')}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {meetings.map((m) => (
                  <tr key={m.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-medium max-w-[240px] truncate" title={m.title}>{m.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><SourceBadge source={m.source} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(m.startTime)}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]" title={m.indexedForUserEmail ?? m.indexedForUserId ?? '—'}>{m.indexedForUserEmail ?? m.indexedForUserId ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]" title={m.indexedByUserEmail ?? m.indexedByUserId ?? '—'}>{m.indexedByUserEmail ?? m.indexedByUserId ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(m.indexedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge ok={!!m.processedAt} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-center">
                      {m.recrawlCount > 0 ? (
                        <span title={`Letzter Recrawl: ${formatDateTime(m.lastRecrawlAt)}`}>{m.recrawlCount}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {m.hasTranscript ? 'Ja' : 'Nein'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {m.hasAnalysis ? 'Vorhanden' : 'Fehlt'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecrawl(m)}
                          disabled={
                            recrawling === m.id ||
                            !m.indexedForUserId ||
                            !m.hasTranscript ||
                            m.isIndexing
                          }
                          title={
                            !m.indexedForUserId
                              ? t('worker.meetings.analyzeMissingUser')
                              : !m.hasTranscript
                                ? t('worker.meetings.analyzeMissingTranscript')
                                : m.isIndexing
                                  ? t('worker.meetings.analyzeInProgress')
                                  : undefined
                          }
                        >
                          {recrawling === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          <span className="ml-1">{m.hasAnalysis ? t('worker.meetings.forceAnalyze') : t('worker.meetings.analyze')}</span>
                        </Button>
                        {recrawlMsg?.id === m.id && (
                          <span className={cn('text-xs', recrawlMsg.type === 'success' ? 'text-green-500' : 'text-destructive')}>
                            {recrawlMsg.text}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminWorkerPage() {
  const t = useTranslations('admin')
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('checkpoint')
  const [checkpoint, setCheckpoint] = useState<CheckpointState | null>(null)
  const [loadingState, setLoadingState] = useState(true)

  const fetchCheckpoint = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/worker/checkpoint')
      if (res.status === 403) {
        router.replace('/dashboard')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setCheckpoint(data)
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingState(false)
    }
  }, [router])

  useEffect(() => {
    fetchCheckpoint()
  }, [fetchCheckpoint])

  if (loadingState) {
    return (
      <>
        <AppHeader activeLink="admin" />
        <main className="container mx-auto px-4 py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    )
  }

  return (
    <>
      <AppHeader activeLink="admin" />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Database className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t('worker.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('worker.subtitle')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(['checkpoint', 'meetings'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              )}
            >
              {t(`worker.tabs.${tab}`)}
            </button>
          ))}
        </div>

        {activeTab === 'checkpoint' && (
          <CheckpointTab t={t} checkpoint={checkpoint} onRefresh={fetchCheckpoint} />
        )}
        {activeTab === 'meetings' && (
          <MeetingsTab t={t} />
        )}
      </main>
    </>
  )
}
