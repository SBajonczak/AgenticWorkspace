'use client'

import { useState } from 'react'

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
        setApiError(data?.error ?? `HTTP ${res.status}`)
        return
      }

      setResults(Array.isArray(data) ? data : [data])
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
