'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import MeetingSummaryCard from '@/components/cards/MeetingSummaryCard'
import TodoList from '@/components/cards/TodoList'

interface Meeting {
  id: string
  meetingId: string
  title: string
  organizer: string
  startTime: string
  endTime: string
  summary: string
  decisions: string
  processedAt: string
  todos: Todo[]
}

interface Todo {
  id: string
  title: string
  description: string
  assigneeHint: string | null
  confidence: number
  status: string
  jiraSync: JiraSync | null
}

interface JiraSync {
  id: string
  jiraIssueKey: string | null
  status: string
  syncedAt: string | null
}

export default function DashboardPage() {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLatestMeeting()
  }, [])

  const fetchLatestMeeting = async () => {
    try {
      const response = await fetch('/api/meetings/latest')
      if (response.ok) {
        const data = await response.json()
        setMeeting(data)
      }
    } catch (error) {
      console.error('Failed to fetch meeting:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              Agentic Workplace
            </Link>
            <nav className="flex gap-6">
              <Link href="/dashboard" className="text-purple-400 font-semibold">
                Dashboard
              </Link>
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                Home
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {!meeting ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-3xl font-bold text-white mb-4">No meetings processed yet</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Run the agent to process your latest Microsoft Teams meeting and see results here.
            </p>
            <button
              onClick={() => alert('Configure your environment and run: npm run agent')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
            >
              Run Agent
            </button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Hero Stats */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid md:grid-cols-4 gap-4"
            >
              <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-6 rounded-xl">
                <div className="text-3xl font-bold text-white">
                  {meeting.todos.length}
                </div>
                <div className="text-purple-200 text-sm">TODOs Extracted</div>
              </div>
              <div className="bg-gradient-to-br from-pink-600 to-pink-800 p-6 rounded-xl">
                <div className="text-3xl font-bold text-white">
                  {JSON.parse(meeting.decisions).length}
                </div>
                <div className="text-pink-200 text-sm">Decisions Made</div>
              </div>
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-xl">
                <div className="text-3xl font-bold text-white">
                  {meeting.todos.filter(t => t.jiraSync?.status === 'synced').length}
                </div>
                <div className="text-blue-200 text-sm">Synced to Jira</div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-green-800 p-6 rounded-xl">
                <div className="text-3xl font-bold text-white">
                  {(meeting.todos.reduce((sum, t) => sum + t.confidence, 0) / meeting.todos.length * 100).toFixed(0)}%
                </div>
                <div className="text-green-200 text-sm">Avg Confidence</div>
              </div>
            </motion.div>

            {/* Meeting Summary */}
            <MeetingSummaryCard meeting={meeting} />

            {/* TODO List */}
            <TodoList todos={meeting.todos} />
          </div>
        )}
      </main>
    </div>
  )
}
