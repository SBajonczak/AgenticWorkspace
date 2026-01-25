'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { getProjectById, getMeetingById } from '@/mocks'

export default function ProjectDetailPage() {
  const params = useParams()
  const tCommon = useTranslations('common')
  const tDetail = useTranslations('projects.detail')
  const [activeTab, setActiveTab] = useState<'overview' | 'updates' | 'meetings' | 'actions'>('overview')

  const project = getProjectById(params.id as string)

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <div className="text-white text-2xl mb-4">Project not found</div>
          <Link href="/projects" className="text-purple-400 hover:text-purple-300">
            ← Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  const relatedMeetings = project.relatedMeetingIds.map(id => getMeetingById(id)).filter(Boolean)
  const getStatusColor = (status: typeof project.status) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400'
      case 'on_hold':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'completed':
        return 'bg-blue-500/20 text-blue-400'
    }
  }

  const getUpdateTypeColor = (type: string) => {
    switch (type) {
      case 'progress':
        return 'bg-blue-500/20 text-blue-400'
      case 'blocker':
        return 'bg-red-500/20 text-red-400'
      case 'milestone':
        return 'bg-green-500/20 text-green-400'
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
            href="/projects"
            className="text-purple-400 hover:text-purple-300 mb-4 inline-block"
          >
            ← {tDetail('backToList')}
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{project.name}</h1>
              <p className="text-gray-400">{project.description}</p>
            </div>
            <span className={`text-sm font-semibold px-4 py-2 rounded-full ${getStatusColor(project.status)}`}>
              {tDetail(`status.${project.status}`)}
            </span>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex gap-3 border-b border-gray-700"
        >
          {(['overview', 'updates', 'meetings', 'actions'] as const).map((tab) => (
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
        </motion.div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* AI Summary */}
              <div className="bg-purple-900/30 backdrop-blur rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-lg font-bold text-purple-400 mb-3">{tDetail('overview.aiSummary')}</h3>
                <p className="text-gray-300 leading-relaxed">{project.aiSummary}</p>
              </div>

              {/* Metadata Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-bold text-white mb-4">{tDetail('overview.metadata.owner')}</h3>
                  <p className="text-gray-300">👤 {project.owner}</p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-bold text-white mb-4">{tDetail('overview.metadata.progress')}</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all"
                        style={{ width: `${project.completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-xl font-bold text-white">{project.completionPercentage}%</span>
                  </div>
                </div>
                <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-bold text-white mb-4">{tDetail('overview.metadata.startDate')}</h3>
                  <p className="text-gray-300">{new Date(project.startDate).toLocaleDateString()}</p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
                  <h3 className="text-lg font-bold text-white mb-4">{tDetail('overview.metadata.targetDate')}</h3>
                  <p className="text-gray-300">{new Date(project.targetDate).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Team */}
              <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">{tDetail('overview.metadata.team')}</h3>
                <div className="flex flex-wrap gap-2">
                  {project.team.map((member, index) => (
                    <span key={index} className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
                      👤 {member}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Updates Tab */}
          {activeTab === 'updates' && (
            <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">{tDetail('updates.title')}</h3>
              {project.updates.length === 0 ? (
                <p className="text-gray-400 text-center py-8">{tDetail('updates.noUpdates')}</p>
              ) : (
                <div className="space-y-4">
                  {project.updates.map((update) => (
                    <div key={update.id} className="bg-gray-900/50 rounded-lg p-4 border-l-4 border-purple-500">
                      <div className="flex items-start justify-between mb-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${getUpdateTypeColor(update.type)}`}>
                          {tDetail(`updates.types.${update.type}`)}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(update.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-300 mb-2">{update.content}</p>
                      <p className="text-xs text-gray-500">by {update.author}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Meetings Tab */}
          {activeTab === 'meetings' && (
            <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">{tDetail('meetings.title')}</h3>
              {relatedMeetings.length === 0 ? (
                <p className="text-gray-400 text-center py-8">{tDetail('meetings.noMeetings')}</p>
              ) : (
                <div className="space-y-3">
                  {relatedMeetings.map((meeting) => (
                    <Link
                      key={meeting!.id}
                      href={`/meetings/${meeting!.id}`}
                      className="block bg-gray-900/50 rounded-lg p-4 hover:bg-gray-900/70 transition-colors"
                    >
                      <h4 className="text-white font-semibold mb-1">{meeting!.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>👤 {meeting!.organizer}</span>
                        <span>•</span>
                        <span>📅 {new Date(meeting!.startTime).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">{tDetail('actions.title')}</h3>
              {project.openActions === 0 ? (
                <p className="text-gray-400 text-center py-8">{tDetail('actions.noActions')}</p>
              ) : (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-2xl font-bold text-white mb-2">{project.openActions}</p>
                  <p className="text-gray-400">{tDetail('actions.title')}</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
