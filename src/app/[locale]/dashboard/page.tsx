'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import PersonalContextBar from '@/components/ui/PersonalContextBar'
import WeatherIndicator from '@/components/ui/WeatherIndicator'
import GreetingSummary from '@/components/ui/GreetingSummary'
import RunAgentButton from '@/components/ui/RunAgentButton'
import {
  RecentIntelligenceWidget,
  UpcomingMeetingsWidget,
  ActiveProjectsWidget,
  CompanyDirectionWidget
} from '@/components/widgets'
import {
  getActiveProjects,
  mockGoals,
  mockMarketSignals,
  mockUser,
  mockWeather,
  mockDailyStats
} from '@/mocks'
import { MeetingListItem, MeetingsListResponse } from '@/types/meetings'

export default function DashboardPage() {
  const tCommon = useTranslations('common')
  const tDashboard = useTranslations('dashboard')
  const [recentMeetings, setRecentMeetings] = useState<MeetingListItem[]>([])
  const [upcomingMeetings, setUpcomingMeetings] = useState<MeetingListItem[]>([])

  useEffect(() => {
    let active = true

    const loadMeetingWidgets = async () => {
      try {
        const [recentResponse, upcomingResponse] = await Promise.all([
          fetch('/api/meetings?kind=completed&limit=3'),
          fetch('/api/meetings?kind=upcoming&limit=3'),
        ])

        if (!recentResponse.ok || !upcomingResponse.ok) {
          throw new Error('Failed to load meeting widgets')
        }

        const [recentData, upcomingData] = (await Promise.all([
          recentResponse.json(),
          upcomingResponse.json(),
        ])) as [MeetingsListResponse, MeetingsListResponse]

        if (active) {
          setRecentMeetings(recentData.meetings || [])
          setUpcomingMeetings(upcomingData.meetings || [])
        }
      } catch {
        if (active) {
          setRecentMeetings([])
          setUpcomingMeetings([])
        }
      }
    }

    loadMeetingWidgets()

    return () => {
      active = false
    }
  }, [])

  // Keep non-meeting dashboard cards on mock data for now.
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
        {/* Personal Context Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 space-y-6"
        >
          {/* Greeting & Summary */}
          <GreetingSummary user={mockUser} stats={mockDailyStats} />
          
          {/* Personal Context Bar */}
          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-gray-700/50">
            <PersonalContextBar user={mockUser} />
            <div className="hidden sm:block h-6 w-px bg-gray-700/50" />
            <WeatherIndicator weather={mockWeather} />
          </div>
        </motion.div>

        {/* Agent Trigger */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 p-5 rounded-xl border border-gray-700/50 bg-gray-800/40 backdrop-blur"
        >
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Meeting-Transkripte verarbeiten
          </h2>
          <RunAgentButton />
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
