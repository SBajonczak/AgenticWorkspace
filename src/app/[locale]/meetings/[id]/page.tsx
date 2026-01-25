'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Link } from '@/i18n/routing'

interface Meeting {
  id: string
  meetingId: string
  title: string
  organizer: string
  startTime: string
  endTime: string
  transcript: string
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
  jiraSync: any
}

export default function MeetingDetailPage() {
  const params = useParams()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchMeeting(params.id as string)
    }
  }, [params.id])

  const fetchMeeting = async (id: string) => {
    try {
      const response = await fetch(`/api/meetings/${id}`)
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

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <div className="text-white text-2xl mb-4">Meeting not found</div>
          <Link href="/dashboard" className="text-purple-400 hover:text-purple-300">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const decisions = JSON.parse(meeting.decisions)
  const startTime = new Date(meeting.startTime)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
              Agentic Workplace
            </Link>
            <Link href="/dashboard" className="text-purple-400 hover:text-purple-300">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Meeting Header */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
            <h1 className="text-4xl font-bold text-white mb-4">{meeting.title}</h1>
            <div className="flex items-center gap-6 text-gray-400">
              <span>👤 {meeting.organizer}</span>
              <span>📅 {startTime.toLocaleString()}</span>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-4">Summary</h2>
            <p className="text-gray-300 leading-relaxed">{meeting.summary}</p>
          </div>

          {/* Decisions */}
          {decisions.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">Decisions</h2>
              <ul className="space-y-3">
                {decisions.map((decision: string, index: number) => (
                  <li key={index} className="flex items-start gap-3 text-gray-300">
                    <span className="text-green-400 text-xl">✓</span>
                    <span>{decision}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript */}
          {meeting.transcript && (
            <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">Transcript</h2>
              <div className="bg-gray-900/50 rounded-lg p-6 max-h-96 overflow-y-auto">
                <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
                  {meeting.transcript}
                </pre>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
