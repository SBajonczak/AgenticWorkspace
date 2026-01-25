'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { mockGoals, mockMarketSignals, MarketSignal } from '@/mocks'

export default function GoalsPage() {
  const tCommon = useTranslations('common')
  const tGoals = useTranslations('goals')

  const getImpactColor = (impact: MarketSignal['impact']) => {
    switch (impact) {
      case 'high':
        return 'bg-red-500/20 text-red-400'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'low':
        return 'bg-green-500/20 text-green-400'
    }
  }

  const getTypeIcon = (type: MarketSignal['type']) => {
    switch (type) {
      case 'competitor':
        return '⚔️'
      case 'trend':
        return '📈'
      case 'regulation':
        return '⚖️'
      case 'technology':
        return '🔬'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'revenue':
        return 'bg-green-500/20 text-green-400'
      case 'product':
        return 'bg-blue-500/20 text-blue-400'
      case 'customer':
        return 'bg-purple-500/20 text-purple-400'
      case 'operational':
        return 'bg-orange-500/20 text-orange-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getSignalTypeColor = (type: MarketSignal['type']) => {
    switch (type) {
      case 'competitor':
        return 'bg-red-500/20 text-red-400'
      case 'trend':
        return 'bg-blue-500/20 text-blue-400'
      case 'regulation':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'technology':
        return 'bg-purple-500/20 text-purple-400'
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
            href="/dashboard"
            className="text-purple-400 hover:text-purple-300 mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">{tGoals('title')}</h1>
          <p className="text-gray-400">{tGoals('subtitle')}</p>
        </motion.div>

        {/* Company Goals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold text-white mb-6">{tGoals('labels.goal')}</h2>
          <div className="space-y-6">
            {mockGoals.map((goal, index) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{goal.title}</h3>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getCategoryColor(goal.category)}`}>
                        {tGoals(`categories.${goal.category}`)}
                      </span>
                    </div>
                    <p className="text-gray-400 mb-3">{goal.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-purple-400">{goal.progress}%</div>
                    <div className="text-xs text-gray-400">{tGoals('labels.progress')}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  {goal.metrics.map((metric, idx) => (
                    <div key={idx} className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">{metric.label}</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-white">{metric.current}</span>
                        <span className="text-xs text-gray-400">/ {metric.target}</span>
                        <span className="text-xs text-gray-400">{metric.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-6 text-sm text-gray-400 mb-4">
                  <span>{tGoals('labels.owner')}: <span className="text-white">👤 {goal.owner}</span></span>
                  <span>•</span>
                  <span>{tGoals('labels.deadline')}: <span className="text-white">{new Date(goal.targetDate).toLocaleDateString()}</span></span>
                </div>

                {/* Agent Recommendation */}
                {goal.agentRecommendation && (
                  <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                    <p className="text-xs text-purple-400 mb-1">{tGoals('insights.recommendation')}</p>
                    <p className="text-sm text-gray-300 italic">{goal.agentRecommendation}</p>
                  </div>
                )}

                {/* Related Projects */}
                {goal.relatedProjectIds.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-400 mb-2">{tGoals('labels.relatedProjects')}:</p>
                    <div className="flex flex-wrap gap-2">
                      {goal.relatedProjectIds.map((projectId) => (
                        <Link
                          key={projectId}
                          href={`/projects/${projectId}`}
                          className="text-xs text-purple-400 hover:text-purple-300 bg-purple-500/20 px-2 py-1 rounded"
                        >
                          🔗 {projectId}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Market Signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-white mb-6">{tGoals('signals.title')}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {mockMarketSignals.map((signal, index) => (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * index }}
                className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getTypeIcon(signal.type)}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getSignalTypeColor(signal.type)}`}>
                      {tGoals(`signals.types.${signal.type}`)}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getImpactColor(signal.impact)}`}>
                    {tGoals(`signals.impact.${signal.impact}`)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{signal.title}</h3>
                <p className="text-sm text-gray-400 mb-3">{signal.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{tGoals('signals.source')}: {signal.source}</span>
                  <span>•</span>
                  <span>{new Date(signal.date).toLocaleDateString()}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  )
}
