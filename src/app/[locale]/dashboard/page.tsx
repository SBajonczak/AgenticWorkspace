'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import AppHeader from '@/components/layout/AppHeader'
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
  mockWeather,
  mockDailyStats
} from '@/mocks'
import { MeetingListItem, MeetingsApiResponse } from '@/types/meetings'
import { DashboardUserProfile } from '@/types/user'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const DASHBOARD_MEETINGS_REFRESH_MS = 15000

const DEFAULT_USER_PROFILE: DashboardUserProfile = {
  id: '',
  name: '',
  email: null,
  role: null,
  location: null,
  initials: '??',
  avatarUrl: null,
}

export default function DashboardPage() {
  const [recentMeetings, setRecentMeetings] = useState<MeetingListItem[]>([])
  const [upcomingMeetings, setUpcomingMeetings] = useState<MeetingListItem[]>([])
  const [recentMeetingsUpdatedAt, setRecentMeetingsUpdatedAt] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<DashboardUserProfile>(DEFAULT_USER_PROFILE)

  useEffect(() => {
    let active = true

    const loadMeetingWidgets = async () => {
      try {
        const [recentResponse, upcomingResponse] = await Promise.all([
          fetch('/api/meetings?kind=all&limit=3', { cache: 'no-store' }),
          fetch('/api/meetings?kind=upcoming&limit=3', { cache: 'no-store' }),
        ])

        if (!recentResponse.ok || !upcomingResponse.ok) {
          throw new Error('Failed to load meeting widgets')
        }

        const [recentData, upcomingData] = (await Promise.all([
          recentResponse.json(),
          upcomingResponse.json(),
        ])) as [MeetingsApiResponse, MeetingsApiResponse]

        const normalizedRecentMeetings = Array.isArray(recentData) ? recentData : recentData.meetings
        const normalizedUpcomingMeetings = Array.isArray(upcomingData) ? upcomingData : upcomingData.meetings

        if (active) {
          setRecentMeetings(normalizedRecentMeetings || [])
          setUpcomingMeetings(normalizedUpcomingMeetings || [])
          setRecentMeetingsUpdatedAt(new Date().toISOString())
        }
      } catch {
        if (active) {
          setRecentMeetings([])
          setUpcomingMeetings([])
        }
      }
    }

    const loadCurrentUser = async () => {
      try {
        const response = await fetch('/api/user/me', { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load current user profile')
        const data = (await response.json()) as DashboardUserProfile
        if (active) {
          setCurrentUser({
            ...DEFAULT_USER_PROFILE,
            ...data,
            name: data.name?.trim() || DEFAULT_USER_PROFILE.name,
            initials: data.initials?.trim() || DEFAULT_USER_PROFILE.initials,
          })
        }
      } catch {
        if (active) setCurrentUser(DEFAULT_USER_PROFILE)
      }
    }

    loadMeetingWidgets()
    loadCurrentUser()

    const intervalId = setInterval(loadMeetingWidgets, DASHBOARD_MEETINGS_REFRESH_MS)

    const handleWindowFocus = () => {
      void loadMeetingWidgets()
      void loadCurrentUser()
    }
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadMeetingWidgets()
        void loadCurrentUser()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      clearInterval(intervalId)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const activeProjects = getActiveProjects(3)
  const goals = mockGoals.slice(0, 5)
  const signals = mockMarketSignals
  const weatherForDisplay = {
    ...mockWeather,
    city: currentUser.location || mockWeather.city,
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader activeLink="dashboard" />

      <main className="container mx-auto px-4 py-12">
        {/* Personal Context Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 space-y-6"
        >
          <GreetingSummary user={currentUser} stats={mockDailyStats} />
          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-border/50">
            <PersonalContextBar user={currentUser} />
            <Separator orientation="vertical" className="hidden sm:block h-6" />
            <WeatherIndicator weather={weatherForDisplay} />
          </div>
        </motion.div>

        {/* Agent Trigger */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Meeting-Transkripte verarbeiten
                </h2>
                <Link href="/settings" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                  Status & Logs
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <RunAgentButton />
            </CardContent>
          </Card>
        </motion.div>

        {/* Widget Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <RecentIntelligenceWidget meetings={recentMeetings} lastUpdatedAt={recentMeetingsUpdatedAt} />
          <UpcomingMeetingsWidget meetings={upcomingMeetings} lastUpdatedAt={recentMeetingsUpdatedAt} />
          <ActiveProjectsWidget projects={activeProjects} />
          <CompanyDirectionWidget goals={goals} signals={signals} />
        </div>
      </main>
    </div>
  )
}
