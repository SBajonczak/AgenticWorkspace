'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { CompanyGoal, MarketSignal } from '@/mocks'

interface CompanyDirectionWidgetProps {
  goals: CompanyGoal[]
  signals: MarketSignal[]
}

export default function CompanyDirectionWidget({ goals, signals }: CompanyDirectionWidgetProps) {
  const t = useTranslations('widgets.companyDirection')

  const highImpactSignals = signals.filter(s => s.impact === 'high')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gradient-to-br from-pink-900/50 to-gray-800/50 backdrop-blur rounded-2xl p-6 border border-pink-500/30 hover:border-pink-500/50 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{t('title')}</h3>
          <p className="text-sm text-gray-400">{t('subtitle')}</p>
        </div>
        <span className="text-3xl">🎯</span>
      </div>

      <div className="space-y-4 mb-4">
        {/* Goals Summary */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold">{t('goals')}</h4>
            <span className="text-2xl font-bold text-pink-400">{goals.length}</span>
          </div>
          <div className="space-y-2">
            {goals.slice(0, 2).map((goal) => (
              <div key={goal.id} className="flex items-center gap-2">
                <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-purple-500 h-full transition-all"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 min-w-[3rem] text-right">
                  {goal.progress}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Market Signals */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold">{t('signals')}</h4>
            <span className="text-xs font-semibold text-orange-400 bg-orange-500/20 px-2 py-1 rounded">
              {highImpactSignals.length} {t('highImpact')}
            </span>
          </div>
          <div className="space-y-2">
            {highImpactSignals.slice(0, 2).map((signal) => (
              <div key={signal.id} className="text-sm text-gray-300">
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 mt-0.5">⚠️</span>
                  <p className="flex-1 line-clamp-2">{signal.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Link
        href="/goals"
        className="block text-center text-pink-400 hover:text-pink-300 transition-colors text-sm font-semibold"
      >
        {t('viewDetails')} →
      </Link>
    </motion.div>
  )
}
