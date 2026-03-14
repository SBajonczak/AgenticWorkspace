'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Loader2, Play } from 'lucide-react'

interface AgentRunResult {
  success: boolean
  meetingId?: string
  meetingTitle?: string
  todosCreated?: number
  jiraSynced?: number
  error?: string
  dryRun: boolean
}

export default function RunAgentButton() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<AgentRunResult[] | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    isProcessing: boolean
    nextRunAt: string | null
    lastRunAt: string | null
    consentRequired: boolean
    lastError: string | null
  } | null>(null)

  const lastUpdatedLabel = status?.lastRunAt
    ? `Zuletzt aktualisiert: ${new Date(status.lastRunAt).toLocaleString()}`
    : null

  async function loadStatus() {
    try {
      const res = await fetch('/api/agent/status', { method: 'GET' })
      if (!res.ok) return
      const data = await res.json()
      setStatus(data)
    } catch {
      // ignore transient status polling failures
    }
  }

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      if (!mounted) return
      await loadStatus()
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  async function handleRun() {
    setLoading(true)
    setResults(null)
    setApiError(null)
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.code === 'auth_reauth_required') {
          setApiError('Consent fehlt oder Token ist abgelaufen. Bitte erneut anmelden und Berechtigungen bestätigen.')
          await loadStatus()
          return
        }
        setApiError(data?.error ?? `HTTP ${res.status}`)
        return
      }
      setResults(Array.isArray(data) ? data : [{ success: true, meetingTitle: 'Verarbeitung gestartet', dryRun: false }])
      await loadStatus()
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleRun} disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Agent läuft…
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Meeting-Transkripte abrufen
          </>
        )}
      </Button>

      {apiError && (
        <Card className="border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="font-semibold">Fehler:</span> {apiError}
        </Card>
      )}

      {lastUpdatedLabel && (
        <p className="text-[11px] text-muted-foreground">{lastUpdatedLabel}</p>
      )}

      {results && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <Card
              key={i}
              className={cn(
                'px-4 py-3 text-sm',
                r.success
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
              )}
            >
              <p className="font-semibold">{r.meetingTitle ?? 'Meeting'}</p>
              {r.success ? (
                <p className="text-xs mt-0.5 opacity-80">
                  TODOs: {r.todosCreated ?? 0} · Jira: {r.jiraSynced ?? 0}
                  {r.dryRun && ' · Dry Run'}
                </p>
              ) : (
                <p className="text-xs mt-0.5 opacity-80">{r.error}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
