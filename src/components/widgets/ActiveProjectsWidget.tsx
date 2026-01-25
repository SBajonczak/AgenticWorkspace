'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Project } from '@/mocks'

interface ActiveProjectsWidgetProps {
  projects: Project[]
}

export default function ActiveProjectsWidget({ projects }: ActiveProjectsWidgetProps) {
  const t = useTranslations('widgets.activeProjects')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gradient-to-br from-green-900/50 to-gray-800/50 backdrop-blur rounded-2xl p-6 border border-green-500/30 hover:border-green-500/50 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{t('title')}</h3>
          <p className="text-sm text-gray-400">{t('subtitle')}</p>
        </div>
        <span className="text-3xl">🚀</span>
      </div>

      {projects.length === 0 ? (
        <p className="text-gray-400 text-center py-8">{t('noProjects')}</p>
      ) : (
        <div className="space-y-3 mb-4">
          {projects.slice(0, 3).map((project, index) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block bg-gray-900/50 rounded-lg p-4 hover:bg-gray-900/70 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-white font-semibold flex-1">{project.name}</h4>
                <div className="text-xs font-semibold text-green-400 bg-green-500/20 px-2 py-1 rounded">
                  {project.completionPercentage}% {t('progress')}
                </div>
              </div>
              <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                {project.aiSummary}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>👤 {project.owner}</span>
                <span>•</span>
                <span>
                  {project.openActions} {project.openActions === 1 ? t('openActions') : t('openActions_plural')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/projects"
        className="block text-center text-green-400 hover:text-green-300 transition-colors text-sm font-semibold"
      >
        {t('viewAll')} →
      </Link>
    </motion.div>
  )
}
