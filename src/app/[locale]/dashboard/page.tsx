'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import {
  RecentIntelligenceWidget,
  UpcomingMeetingsWidget,
  ActiveProjectsWidget,
  CompanyDirectionWidget
} from '@/components/widgets'
import {
  getRecentMeetings,
  getUpcomingMeetings,
  getActiveProjects,
  mockGoals,
  mockMarketSignals
} from '@/mocks'

export default function DashboardPage() {
  const tCommon = useTranslations('common')
  const tDashboard = useTranslations('dashboard')

  // Get data from mocks
  const recentMeetings = getRecentMeetings(3)
  const upcomingMeetings = getUpcomingMeetings(3)
  const activeProjects = getActiveProjects(3)
  const goals = mockGoals.slice(0, 5)
  const signals = mockMarketSignals

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
              <Link href="/dashboard" className="text-purple-400 font-semibold">
                {tCommon('navigation.dashboard')}
              </Link>
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                {tCommon('navigation.home')}
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
          <h1 className="text-4xl font-bold text-white mb-2">{tDashboard('title')}</h1>
          <p className="text-gray-400">Your intelligent workspace overview</p>
        </motion.div>

        {/* Widget Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <RecentIntelligenceWidget meetings={recentMeetings} />
          <UpcomingMeetingsWidget meetings={upcomingMeetings} />
          <ActiveProjectsWidget projects={activeProjects} />
          <CompanyDirectionWidget goals={goals} signals={signals} />
        </div>
      </main>
    </div>
  )
}
