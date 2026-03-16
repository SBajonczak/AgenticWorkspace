'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

const SETTINGS_STATUS_REFRESH_MS = 15000

interface AgentStatusResponse {
  isProcessing: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  lastSuccessAt: string | null
  consentRequired: boolean
  hasRefreshToken: boolean
  lastError: string | null
}

interface TenantSettingsResponse {
  id: string
  name: string
  ticketProvider: string
  ticketConfig: Record<string, unknown> | null
}

interface UserSettingsResponse {
  meetingLookaheadDays: number
}

// ---------------------------------------------------------------------------
// Tenant ticket-provider form
// ---------------------------------------------------------------------------

type ProviderType = 'jira' | 'github' | 'azuredevops' | 'none'

function TicketProviderForm({ initial }: { initial: TenantSettingsResponse }) {
  const [provider, setProvider] = useState<ProviderType>(initial.ticketProvider as ProviderType)
  const [config, setConfig] = useState<Record<string, string>>(
    (initial.ticketConfig as Record<string, string> | null) ?? {}
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/tenants/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketProvider: provider, ticketConfig: config }),
      })
      if (res.ok) { setSaved(true) } else { const d = await res.json(); setError(d.error ?? 'Error') }
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  const field = (key: string, label: string, secret = false) => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input
        type={secret ? 'password' : 'text'}
        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
        value={config[key] ?? ''}
        onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))}
        autoComplete="off"
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Provider</label>
        <select
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={provider}
          onChange={(e) => { setProvider(e.target.value as ProviderType); setConfig({}) }}
        >
          <option value="none">None</option>
          <option value="jira">Jira</option>
          <option value="github">GitHub</option>
          <option value="azuredevops">Azure DevOps</option>
        </select>
      </div>

      {provider === 'jira' && (
        <>{field('host', 'Host (e.g. https://org.atlassian.net)')}{field('email', 'Email')}{field('apiToken', 'API Token', true)}{field('projectKey', 'Project Key')}</>
      )}
      {provider === 'github' && (
        <>{field('owner', 'Owner')}{field('repo', 'Repository')}{field('token', 'Personal Access Token', true)}</>
      )}
      {provider === 'azuredevops' && (
        <>{field('organization', 'Organization')}{field('project', 'Project')}{field('personalAccessToken', 'Personal Access Token', true)}</>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
      {saved && <p className="text-xs text-green-400">Saved successfully.</p>}
      <Button size="sm" onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('dashboard.settingsPage')

  const [status, setStatus] = useState<AgentStatusResponse | null>(null)
  const [tenantSettings, setTenantSettings] = useState<TenantSettingsResponse | null>(null)
  const [userSettings, setUserSettings] = useState<UserSettingsResponse | null>(null)
  const [lookaheadDraft, setLookaheadDraft] = useState<number>(14)
  const [lookaheadSaving, setLookaheadSaving] = useState(false)
  const [lookaheadSaved, setLookaheadSaved] = useState(false)
  const [lookaheadError, setLookaheadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const loadErrorMessage = tSettings('loadError')

  useEffect(() => {
    let active = true

    const loadStatus = async () => {
      try {
        const [statusRes, tenantRes, userSettingsRes] = await Promise.all([
          fetch('/api/agent/status', { cache: 'no-store' }),
          fetch('/api/tenants/settings', { cache: 'no-store' }),
          fetch('/api/user/settings', { cache: 'no-store' }),
        ])
        if (!statusRes.ok) throw new Error(`Status ${statusRes.status}`)
        if (active) {
          setStatus(await statusRes.json())
          if (tenantRes.ok) setTenantSettings(await tenantRes.json())
          if (userSettingsRes.ok) {
            const userSettingsPayload = (await userSettingsRes.json()) as UserSettingsResponse
            setUserSettings(userSettingsPayload)
            setLookaheadDraft(userSettingsPayload.meetingLookaheadDays)
          }
          setError(null)
          setUpdatedAt(new Date().toISOString())
        }
      } catch {
        if (active) { setStatus(null); setError(loadErrorMessage) }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadStatus()
    const intervalId = setInterval(loadStatus, SETTINGS_STATUS_REFRESH_MS)
    return () => { active = false; clearInterval(intervalId) }
  }, [loadErrorMessage])

  const formatDateTime = (value: string | null) => {
    if (!value) return tSettings('status.unknown')
    return new Date(value).toLocaleString()
  }

  const lastUpdatedLabel = updatedAt
    ? tSettings('updatedAt', { time: new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
    : null

  const handleSaveLookahead = async () => {
    setLookaheadSaving(true)
    setLookaheadSaved(false)
    setLookaheadError(null)

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingLookaheadDays: lookaheadDraft }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setLookaheadError(payload?.error ? tSettings('preparation.invalidValue') : tSettings('preparation.saveError'))
        return
      }

      const payload = (await res.json()) as UserSettingsResponse
      setUserSettings(payload)
      setLookaheadDraft(payload.meetingLookaheadDays)
      setLookaheadSaved(true)
    } catch {
      setLookaheadError(tSettings('preparation.saveError'))
    } finally {
      setLookaheadSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              {tCommon('brand.name')}
            </Link>
            <nav className="flex gap-6 items-center">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">{tCommon('navigation.dashboard')}</Link>
              <Link href="/settings" className="text-purple-400 font-semibold">{tCommon('navigation.settings')}</Link>
              <LanguageSwitcher />
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href="/dashboard" className="text-purple-400 hover:text-purple-300 mb-4 inline-block">
            {tSettings('backToDashboard')}
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">{tSettings('title')}</h1>
          <p className="text-gray-400">{tSettings('subtitle')}</p>
          {lastUpdatedLabel && <p className="text-[11px] text-gray-500 mt-2">{lastUpdatedLabel}</p>}
        </motion.div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 rounded-lg bg-red-900/40 border border-red-700/50 px-4 py-3 text-sm text-red-300">
            {error}
          </motion.div>
        )}

        <div className="space-y-6">
          {/* Agent Status */}
          {loading ? (
            <div className="h-40 rounded-xl border border-gray-700 bg-gray-800/40 animate-pulse" />
          ) : status ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-gray-700/50 bg-gray-800/40 backdrop-blur p-6">
              <h2 className="text-lg font-semibold text-white mb-4">{tSettings('title')}</h2>
              <div className="space-y-3 text-sm text-gray-200">
                <p><span className="font-semibold">{tCommon('labels.status')}:</span> {status.isProcessing ? tSettings('status.running') : tSettings('status.idle')}</p>
                <p><span className="font-semibold">{tSettings('status.nextRun')}:</span> {formatDateTime(status.nextRunAt)}</p>
                <p><span className="font-semibold">{tSettings('status.lastRun')}:</span> {formatDateTime(status.lastRunAt)}</p>
                <p><span className="font-semibold">{tSettings('status.lastSuccess')}:</span> {formatDateTime(status.lastSuccessAt)}</p>
                <p><span className="font-semibold">{tSettings('status.consent')}:</span> {status.consentRequired ? tSettings('status.yes') : tSettings('status.no')}</p>
                <p><span className="font-semibold">{tSettings('status.refreshToken')}:</span> {status.hasRefreshToken ? tSettings('status.yes') : tSettings('status.no')}</p>
              </div>
            </motion.div>
          ) : null}

          {/* Logs */}
          {status && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-gray-700/50 bg-gray-800/40 backdrop-blur p-6">
              <h2 className="text-lg font-semibold text-white mb-2">{tSettings('logs.title')}</h2>
              <p className={`text-sm ${status.lastError ? 'text-amber-300' : 'text-gray-400'}`}>
                {status.lastError || tSettings('logs.empty')}
              </p>
            </motion.div>
          )}

          {/* Meeting preparation settings */}
          {userSettings && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-xl border border-gray-700/50 bg-gray-800/40 backdrop-blur p-6">
              <h2 className="text-lg font-semibold text-white mb-2">{tSettings('preparation.title')}</h2>
              <p className="text-sm text-gray-400 mb-4">{tSettings('preparation.description')}</p>

              <div className="space-y-3">
                <label htmlFor="meeting-lookahead" className="block text-xs font-medium text-gray-400">
                  {tSettings('preparation.lookaheadLabel')}
                </label>
                <input
                  id="meeting-lookahead"
                  type="range"
                  min={1}
                  max={31}
                  step={1}
                  value={lookaheadDraft}
                  onChange={(event) => setLookaheadDraft(Number(event.target.value))}
                  className="w-full"
                />

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{tSettings('preparation.minLabel')}</span>
                  <span>{tSettings('preparation.maxLabel')}</span>
                </div>

                <p className="text-sm text-gray-200">
                  {tSettings('preparation.currentValue', { days: lookaheadDraft })}
                </p>

                {lookaheadError && <p className="text-xs text-red-400">{lookaheadError}</p>}
                {lookaheadSaved && <p className="text-xs text-green-400">{tSettings('preparation.saved')}</p>}

                <Button
                  size="sm"
                  onClick={handleSaveLookahead}
                  disabled={lookaheadSaving || lookaheadDraft === userSettings.meetingLookaheadDays}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {lookaheadSaving ? tSettings('preparation.saving') : tSettings('preparation.save')}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Ticket Integration */}
          {tenantSettings && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-gray-700/50 bg-gray-800/40 backdrop-blur p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Ticket Integration</h2>
              <TicketProviderForm initial={tenantSettings} />
            </motion.div>
          )}

          {/* Projects & Knowledge Sources */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-gray-700/50 bg-gray-800/40 backdrop-blur p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">{tSettings('projects.title')}</h2>
                <p className="text-sm text-gray-400">
                  {tSettings('projects.description')}
                </p>
              </div>
              <Link href="/projects">
                <Button variant="secondary" size="sm" className="ml-4 gap-1.5 shrink-0">
                  {tSettings('projects.manageButton')} <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
