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
  summaryWindowDays: number
  timezone: string
  workDayStart: string
  workDayEnd: string
  focusTimeSlots: FocusTimeSlot[]
}

interface FocusTimeSlot {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
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
  const [summaryWindowDraft, setSummaryWindowDraft] = useState<number>(7)
  const [summaryWindowSaving, setSummaryWindowSaving] = useState(false)
  const [summaryWindowSaved, setSummaryWindowSaved] = useState(false)
  const [summaryWindowError, setSummaryWindowError] = useState<string | null>(null)
  const [timezoneDraft, setTimezoneDraft] = useState('Europe/Berlin')
  const [workDayStartDraft, setWorkDayStartDraft] = useState('09:00')
  const [workDayEndDraft, setWorkDayEndDraft] = useState('17:00')
  const [focusSlotsDraft, setFocusSlotsDraft] = useState<FocusTimeSlot[]>([])
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
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
            setSummaryWindowDraft(userSettingsPayload.summaryWindowDays)
            setTimezoneDraft(userSettingsPayload.timezone)
            setWorkDayStartDraft(userSettingsPayload.workDayStart)
            setWorkDayEndDraft(userSettingsPayload.workDayEnd)
            setFocusSlotsDraft(userSettingsPayload.focusTimeSlots)
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

  const weekdayOptions = [
    { value: 0, label: tSettings('schedulePreferences.days.0') },
    { value: 1, label: tSettings('schedulePreferences.days.1') },
    { value: 2, label: tSettings('schedulePreferences.days.2') },
    { value: 3, label: tSettings('schedulePreferences.days.3') },
    { value: 4, label: tSettings('schedulePreferences.days.4') },
    { value: 5, label: tSettings('schedulePreferences.days.5') },
    { value: 6, label: tSettings('schedulePreferences.days.6') },
  ]

  const persistUserSettings = async (): Promise<UserSettingsResponse | null> => {
    const res = await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingLookaheadDays: lookaheadDraft,
        summaryWindowDays: summaryWindowDraft,
        timezone: timezoneDraft,
        workDayStart: workDayStartDraft,
        workDayEnd: workDayEndDraft,
        focusTimeSlots: focusSlotsDraft,
      }),
    })

    if (!res.ok) {
      return null
    }

    const payload = (await res.json()) as UserSettingsResponse
    setUserSettings(payload)
    setLookaheadDraft(payload.meetingLookaheadDays)
    setSummaryWindowDraft(payload.summaryWindowDays)
    setTimezoneDraft(payload.timezone)
    setWorkDayStartDraft(payload.workDayStart)
    setWorkDayEndDraft(payload.workDayEnd)
    setFocusSlotsDraft(payload.focusTimeSlots)
    return payload
  }

  const addFocusSlot = () => {
    setFocusSlotsDraft((prev) => [
      ...prev,
      {
        dayOfWeek: 1,
        startTime: workDayStartDraft,
        endTime: workDayEndDraft,
      },
    ])
  }

  const updateFocusSlot = (index: number, patch: Partial<FocusTimeSlot>) => {
    setFocusSlotsDraft((prev) => prev.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)))
  }

  const removeFocusSlot = (index: number) => {
    setFocusSlotsDraft((prev) => prev.filter((_, slotIndex) => slotIndex !== index))
  }

  const handleSaveLookahead = async () => {
    setLookaheadSaving(true)
    setLookaheadSaved(false)
    setLookaheadError(null)

    try {
      const payload = await persistUserSettings()
      if (!payload) {
        setLookaheadError(tSettings('preparation.invalidValue'))
        return
      }
      setLookaheadSaved(true)
    } catch {
      setLookaheadError(tSettings('preparation.saveError'))
    } finally {
      setLookaheadSaving(false)
    }
  }

  const handleSaveSummaryWindow = async () => {
    setSummaryWindowSaving(true)
    setSummaryWindowSaved(false)
    setSummaryWindowError(null)

    try {
      const payload = await persistUserSettings()
      if (!payload) {
        setSummaryWindowError(tSettings('summaryWindow.invalidValue'))
        return
      }
      setSummaryWindowSaved(true)
    } catch {
      setSummaryWindowError(tSettings('summaryWindow.saveError'))
    } finally {
      setSummaryWindowSaving(false)
    }
  }

  const handleSaveSchedulePreferences = async () => {
    setScheduleSaving(true)
    setScheduleSaved(false)
    setScheduleError(null)

    try {
      const payload = await persistUserSettings()
      if (!payload) {
        setScheduleError(tSettings('schedulePreferences.invalidValue'))
        return
      }
      setScheduleSaved(true)
    } catch {
      setScheduleError(tSettings('schedulePreferences.saveError'))
    } finally {
      setScheduleSaving(false)
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

              <div className="mt-8 space-y-3 border-t border-gray-700/50 pt-6">
                <h3 className="text-base font-semibold text-white">{tSettings('summaryWindow.title')}</h3>
                <p className="text-sm text-gray-400">{tSettings('summaryWindow.description')}</p>

                <label htmlFor="summary-window" className="block text-xs font-medium text-gray-400">
                  {tSettings('summaryWindow.label')}
                </label>
                <input
                  id="summary-window"
                  type="range"
                  min={1}
                  max={90}
                  step={1}
                  value={summaryWindowDraft}
                  onChange={(event) => setSummaryWindowDraft(Number(event.target.value))}
                  className="w-full"
                />

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{tSettings('summaryWindow.minLabel')}</span>
                  <span>{tSettings('summaryWindow.maxLabel')}</span>
                </div>

                <p className="text-sm text-gray-200">
                  {tSettings('summaryWindow.currentValue', { days: summaryWindowDraft })}
                </p>

                {summaryWindowError && <p className="text-xs text-red-400">{summaryWindowError}</p>}
                {summaryWindowSaved && <p className="text-xs text-green-400">{tSettings('summaryWindow.saved')}</p>}

                <Button
                  size="sm"
                  onClick={handleSaveSummaryWindow}
                  disabled={summaryWindowSaving || summaryWindowDraft === userSettings.summaryWindowDays}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {summaryWindowSaving ? tSettings('summaryWindow.saving') : tSettings('summaryWindow.save')}
                </Button>
              </div>

              <div className="mt-8 space-y-4 border-t border-gray-700/50 pt-6">
                <h3 className="text-base font-semibold text-white">{tSettings('schedulePreferences.title')}</h3>
                <p className="text-sm text-gray-400">{tSettings('schedulePreferences.description')}</p>

                <div>
                  <label htmlFor="timezone" className="block text-xs font-medium text-gray-400 mb-1">
                    {tSettings('schedulePreferences.timezoneLabel')}
                  </label>
                  <input
                    id="timezone"
                    type="text"
                    value={timezoneDraft}
                    onChange={(event) => setTimezoneDraft(event.target.value)}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="work-day-start" className="block text-xs font-medium text-gray-400 mb-1">
                      {tSettings('schedulePreferences.workDayStartLabel')}
                    </label>
                    <input
                      id="work-day-start"
                      type="time"
                      value={workDayStartDraft}
                      onChange={(event) => setWorkDayStartDraft(event.target.value)}
                      className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="work-day-end" className="block text-xs font-medium text-gray-400 mb-1">
                      {tSettings('schedulePreferences.workDayEndLabel')}
                    </label>
                    <input
                      id="work-day-end"
                      type="time"
                      value={workDayEndDraft}
                      onChange={(event) => setWorkDayEndDraft(event.target.value)}
                      className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400">{tSettings('schedulePreferences.focusSlotsLabel')}</p>

                  {focusSlotsDraft.length === 0 && (
                    <p className="text-xs text-gray-500">{tSettings('schedulePreferences.noSlots')}</p>
                  )}

                  {focusSlotsDraft.map((slot, index) => (
                    <div key={`${slot.id ?? 'new'}-${index}`} className="grid grid-cols-1 gap-2 rounded-md border border-gray-700/60 bg-gray-900/40 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">{tSettings('schedulePreferences.dayLabel')}</label>
                        <select
                          value={slot.dayOfWeek}
                          onChange={(event) => updateFocusSlot(index, { dayOfWeek: Number(event.target.value) })}
                          className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          {weekdayOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">{tSettings('schedulePreferences.slotStartLabel')}</label>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(event) => updateFocusSlot(index, { startTime: event.target.value })}
                          className="rounded-md border border-gray-700 bg-gray-900 px-2 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">{tSettings('schedulePreferences.slotEndLabel')}</label>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(event) => updateFocusSlot(index, { endTime: event.target.value })}
                          className="rounded-md border border-gray-700 bg-gray-900 px-2 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <Button type="button" variant="secondary" size="sm" onClick={() => removeFocusSlot(index)}>
                        {tSettings('schedulePreferences.removeSlot')}
                      </Button>
                    </div>
                  ))}

                  <Button type="button" variant="secondary" size="sm" onClick={addFocusSlot}>
                    {tSettings('schedulePreferences.addSlot')}
                  </Button>
                </div>

                {scheduleError && <p className="text-xs text-red-400">{scheduleError}</p>}
                {scheduleSaved && <p className="text-xs text-green-400">{tSettings('schedulePreferences.saved')}</p>}

                <Button
                  size="sm"
                  onClick={handleSaveSchedulePreferences}
                  disabled={scheduleSaving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {scheduleSaving ? tSettings('schedulePreferences.saving') : tSettings('schedulePreferences.save')}
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
