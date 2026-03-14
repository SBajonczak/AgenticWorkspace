'use client'

import { useEffect, useState } from 'react'

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

  async function loadStatus() {
    try {
      const res = await fetch('/api/agent/status', {
        method: 'GET',
      })

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
      <button
        onClick={handleRun}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
          bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed
          text-white transition-colors shadow"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Agent läuft…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Meeting-Transkripte abrufen
          </>
        )}
      </button>

      {apiError && (
        <div className="rounded-lg bg-red-900/40 border border-red-700/50 px-4 py-3 text-sm text-red-300">
          <span className="font-semibold">Fehler:</span> {apiError}
        </div>
      )}

      {status && (
        <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-4 py-3 text-sm text-slate-200 space-y-1">
          <p>
            <span className="font-semibold">Status:</span>{' '}
            {status.isProcessing ? 'Meetings werden gerade verarbeitet' : 'Kein laufender Verarbeitungsjob'}
          </p>
          <p>
            <span className="font-semibold">Nächster Lauf:</span>{' '}
            {status.nextRunAt ? new Date(status.nextRunAt).toLocaleString() : 'Noch nicht geplant'}
          </p>
          {status.lastRunAt && (
            <p>
              <span className="font-semibold">Letzter Lauf:</span> {new Date(status.lastRunAt).toLocaleString()}
            </p>
          )}
          {status.consentRequired && (
            <p className="text-amber-300">
              Microsoft-Consent fehlt. Bitte neu anmelden und Zugriff bestätigen.
            </p>
          )}
          {status.lastError && !status.isProcessing && (
            <p className="text-amber-300">
              Letzter Fehler: {status.lastError}
            </p>
          )}
        </div>
      )}

      {results && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-lg px-4 py-3 text-sm border ${
                r.success
                  ? 'bg-green-900/30 border-green-700/40 text-green-300'
                  : 'bg-yellow-900/30 border-yellow-700/40 text-yellow-300'
              }`}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
