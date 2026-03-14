'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

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

export default function SettingsPage() {
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('dashboard.settingsPage')

  const [status, setStatus] = useState<AgentStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const loadErrorMessage = tSettings('loadError')

  useEffect(() => {
    let active = true

    const loadStatus = async () => {
      try {
        const response = await fetch('/api/agent/status', { cache: 'no-store' })

        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`)
        }

        const data = (await response.json()) as AgentStatusResponse

        if (active) {
          setStatus(data)
          setError(null)
          setUpdatedAt(new Date().toISOString())
        }
      } catch {
        if (active) {
          setStatus(null)
          setError(loadErrorMessage)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadStatus()
    const intervalId = setInterval(loadStatus, SETTINGS_STATUS_REFRESH_MS)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [loadErrorMessage])

  const formatDateTime = (value: string | null) => {
    if (!value) return tSettings('status.unknown')
    return new Date(value).toLocaleString()
  }

  const lastUpdatedLabel = updatedAt
    ? tSettings('updatedAt', {
        time: new Date(updatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              {tCommon('brand.name')}
            </Link>
            <nav className="flex gap-6 items-center">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                {tCommon('navigation.dashboard')}
              </Link>
              <Link href="/settings" className="text-purple-400 font-semibold">
                {tCommon('navigation.settings')}
              </Link>
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

        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-40 rounded-xl border border-gray-700 bg-gray-800/40 animate-pulse" />
        ) : status ? (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-gray-700/50 bg-gray-800/40 backdrop-blur p-6"
            >
              <div className="space-y-3 text-sm text-gray-200">
                <p>
                  <span className="font-semibold">{tCommon('labels.status')}:</span>{' '}
                  {status.isProcessing ? tSettings('status.running') : tSettings('status.idle')}
                </p>
                <p>
                  <span className="font-semibold">{tSettings('status.nextRun')}:</span> {formatDateTime(status.nextRunAt)}
                </p>
                <p>
                  <span className="font-semibold">{tSettings('status.lastRun')}:</span> {formatDateTime(status.lastRunAt)}
                </p>
                <p>
                  <span className="font-semibold">{tSettings('status.lastSuccess')}:</span> {formatDateTime(status.lastSuccessAt)}
                </p>
                <p>
                  <span className="font-semibold">{tSettings('status.consent')}:</span>{' '}
                  {status.consentRequired ? tSettings('status.yes') : tSettings('status.no')}
                </p>
                <p>
                  <span className="font-semibold">{tSettings('status.refreshToken')}:</span>{' '}
                  {status.hasRefreshToken ? tSettings('status.yes') : tSettings('status.no')}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl border border-gray-700/50 bg-gray-800/40 backdrop-blur p-6"
            >
              <h2 className="text-lg font-semibold text-white mb-2">{tSettings('logs.title')}</h2>
              <p className={`text-sm ${status.lastError ? 'text-amber-300' : 'text-gray-400'}`}>
                {status.lastError || tSettings('logs.empty')}
              </p>
            </motion.div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
