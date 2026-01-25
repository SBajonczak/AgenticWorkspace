'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { mockProjects, Project } from '@/mocks'

export default function ProjectsListPage() {
  const tCommon = useTranslations('common')
  const tList = useTranslations('projects.list')
  const [filter, setFilter] = useState<'all' | 'active' | 'on_hold' | 'completed'>('all')

  const filteredProjects = mockProjects.filter(p => {
    if (filter === 'all') return true
    return p.status === filter
  })

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400'
      case 'on_hold':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'completed':
        return 'bg-blue-500/20 text-blue-400'
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
          {(['all', 'active', 'on_hold', 'completed'] as const).map((f) => (
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

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
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
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * index }}
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="block bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all h-full"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-bold text-white flex-1">{project.name}</h3>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(project.status)}`}>
                      {tList(`status.${project.status}`)}
                    </span>
                  </div>

                  {/* AI Summary */}
                  <div className="mb-4">
                    <p className="text-xs text-purple-400 mb-1">{tList('aiSummary')}</p>
                    <p className="text-sm text-gray-400 line-clamp-3">{project.aiSummary}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>{tList('card.progress')}</span>
                      <span className="font-semibold text-white">{project.completionPercentage}%</span>
                    </div>
                    <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all"
                        style={{ width: `${project.completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-gray-400">
                      <span>{tList('card.owner')}</span>
                      <span className="text-white">👤 {project.owner}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400">
                      <span>{tList('card.openActions')}</span>
                      <span className="text-white font-semibold">
                        {project.openActions} {project.openActions === 1 ? tList('card.openActions') : tList('card.openActions_plural')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400">
                      <span>{tList('card.targetDate')}</span>
                      <span className="text-white">{new Date(project.targetDate).toLocaleDateString()}</span>
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
