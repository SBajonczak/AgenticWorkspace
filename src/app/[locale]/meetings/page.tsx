'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { MeetingListItem, MeetingsListResponse } from '@/types/meetings'

export default function MeetingsListPage() {
  const tCommon = useTranslations('common')
  const tList = useTranslations('meetings.list')
  const [filter, setFilter] = useState<'all' | 'completed' | 'upcoming'>('all')
  const [meetings, setMeetings] = useState<MeetingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadMeetings = async () => {
      try {
        const response = await fetch('/api/meetings?kind=all&limit=100')
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`)
        }

        const data = (await response.json()) as MeetingsListResponse
        if (active) {
          setMeetings(data.meetings || [])
          setError(null)
        }
      } catch (err) {
        if (active) {
          setError('Meetings konnten nicht geladen werden.')
          setMeetings([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadMeetings()

    return () => {
      active = false
    }
  }, [])

  const filteredMeetings = meetings.filter((m) => {
    if (filter === 'all') return true
    return m.status === filter
  })

  const getStatusColor = (status: MeetingListItem['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400'
      case 'upcoming':
        return 'bg-blue-500/20 text-blue-400'
      case 'cancelled':
        return 'bg-red-500/20 text-red-400'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
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
              <Link href="/meetings" className="text-purple-400 font-semibold">
                {tCommon('navigation.meetings')}
              </Link>
              <LanguageSwitcher />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            href="/dashboard"
            className="text-purple-400 hover:text-purple-300 mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">{tList('title')}</h1>
          <p className="text-gray-400">{tList('subtitle')}</p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex gap-3"
        >
          {(['all', 'completed', 'upcoming'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tList(`filters.${f}`)}
            </button>
          ))}
        </motion.div>

        {/* Meetings List */}
        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 rounded-xl border border-gray-700 bg-gray-800/40 animate-pulse" />
            ))}
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-red-400 text-xl">{error}</p>
          </motion.div>
        ) : filteredMeetings.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-gray-400 text-xl">{tList('empty')}</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {filteredMeetings.map((meeting, index) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Link
                  href={`/meetings/${meeting.id}`}
                  className="block bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">{meeting.title}</h3>
                      {meeting.summary && (
                        <p className="text-gray-400 mb-3 line-clamp-2">{meeting.summary}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>👤 {meeting.organizer}</span>
                        <span>•</span>
                        <span>📅 {new Date(meeting.startTime).toLocaleDateString()}</span>
                        {meeting.todos.length > 0 && (
                          <>
                            <span>•</span>
                            <span>
                              ✓ {meeting.todos.length} {meeting.todos.length === 1 ? tList('actionCount') : tList('actionCount_plural')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(meeting.status)}`}>
                        {tList(`status.${meeting.status}`)}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  )
}
