'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { getMeetingById, getProjectsByMeetingId } from '@/mocks'

export default function MeetingDetailPage() {
  const params = useParams()
  const tCommon = useTranslations('common')
  const tDetail = useTranslations('meetings.detail')
  const [activeTab, setActiveTab] = useState<'summary' | 'decisions' | 'actions' | 'transcript'>('summary')

  const meeting = getMeetingById(params.id as string)
  const relatedProjects = meeting ? getProjectsByMeetingId(meeting.id) : []

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <div className="text-white text-2xl mb-4">Meeting not found</div>
          <Link href="/meetings" className="text-purple-400 hover:text-purple-300">
            ← {tDetail('backToList')}
          </Link>
        </div>
      </div>
    )
  }

  const decisions = JSON.parse(meeting.decisions)
  const startTime = new Date(meeting.startTime)
  const endTime = new Date(meeting.endTime)
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-400'
    if (confidence >= 0.7) return 'text-yellow-400'
    return 'text-orange-400'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.85) return tCommon('labels.high')
    if (confidence >= 0.7) return tCommon('labels.medium')
    return tCommon('labels.low')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-500/20 text-green-400'
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
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
              <Link href="/meetings" className="text-gray-400 hover:text-white transition-colors">
                {tCommon('navigation.meetings')}
              </Link>
              <LanguageSwitcher />
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            href="/meetings"
            className="text-purple-400 hover:text-purple-300 mb-4 inline-block"
          >
            ← {tDetail('backToList')}
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Meeting Header */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
            <h1 className="text-4xl font-bold text-white mb-4">{meeting.title}</h1>
            <div className="flex flex-wrap items-center gap-6 text-gray-400">
              <span>{tDetail('summary.metadata.organizer')}: <span className="text-white">👤 {meeting.organizer}</span></span>
              <span>•</span>
              <span>{tDetail('summary.metadata.date')}: <span className="text-white">📅 {startTime.toLocaleString()}</span></span>
              <span>•</span>
              <span>{tDetail('summary.metadata.duration')}: <span className="text-white">⏱️ {duration} {tCommon('labels.minutes')}</span></span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-3 border-b border-gray-700">
            {(['summary', 'decisions', 'actions', 'transcript'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-semibold transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tDetail(`tabs.${tab}`)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Summary Tab */}
            {activeTab === 'summary' && meeting.summary && (
              <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-4">{tDetail('summary.title')}</h2>
                <p className="text-gray-300 leading-relaxed">{meeting.summary}</p>
              </div>
            )}

            {/* Decisions Tab */}
            {activeTab === 'decisions' && (
              <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-4">
                  {tDetail('decisions.title')} ({decisions.length})
                </h2>
                {decisions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">{tDetail('decisions.noDecisions')}</p>
                ) : (
                  <ul className="space-y-3">
                    {decisions.map((decision: string, index: number) => (
                      <li key={index} className="flex items-start gap-3 text-gray-300 bg-gray-900/50 rounded-lg p-4">
                        <span className="text-green-400 text-xl">✓</span>
                        <span>{decision}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-6">{tDetail('actions.title')}</h2>
                {meeting.todos.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">{tDetail('actions.noActions')}</p>
                ) : (
                  <div className="space-y-4">
                    {meeting.todos.map((todo) => (
                      <div
                        key={todo.id}
                        className="bg-gray-900/50 rounded-xl p-6 border border-gray-700"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-white flex-1">{todo.title}</h3>
                          <div className="flex items-center gap-3">
                            <div className={`text-sm font-medium ${getConfidenceColor(todo.confidence)}`}>
                              {getConfidenceLabel(todo.confidence)} ({Math.round(todo.confidence * 100)}%)
                            </div>
                            {todo.jiraSync && todo.jiraSync.status === 'synced' && (
                              <span className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-full">
                                <span>📋</span>
                                <span>{todo.jiraSync.jiraIssueKey}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-gray-400 mb-4">{todo.description}</p>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4">
                            {todo.assigneeHint && (
                              <span className="text-gray-400">
                                {tDetail('actions.assignedTo')}: <span className="text-purple-400">👤 {todo.assigneeHint}</span>
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(todo.status)}`}>
                              {tDetail(`actions.status.${todo.status}`)}
                            </span>
                          </div>

                          {todo.jiraSync && todo.jiraSync.status === 'failed' && (
                            <span className="text-red-400 text-xs">❌ {tDetail('actions.jira.failed')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transcript Tab */}
            {activeTab === 'transcript' && (
              <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-4">{tDetail('transcript.title')}</h2>
                {meeting.transcript ? (
                  <div className="bg-gray-900/50 rounded-lg p-6 max-h-96 overflow-y-auto">
                    <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
                      {meeting.transcript}
                    </pre>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">{tDetail('transcript.noTranscript')}</p>
                )}
              </div>
            )}
          </motion.div>

          {/* Related Projects */}
          {relatedProjects.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">{tDetail('relatedProjects.title')}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {relatedProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block bg-gray-900/50 rounded-lg p-4 hover:bg-gray-900/70 transition-colors"
                  >
                    <h3 className="text-white font-semibold mb-2">{project.name}</h3>
                    <p className="text-sm text-gray-400 line-clamp-2">{project.aiSummary}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
