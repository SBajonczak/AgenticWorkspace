'use client'

import { useEffect, useState } from 'react'
import { ProjectStatusBadge } from '../cards/ProjectStatusBadge'

interface ProjectStatus {
  id: string
  projectName: string
  status: string
  summary: string
  createdAt: string
  meeting?: {
    title: string
    startTime: string
  }
}

export function ProjectStatusWidget() {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects/status')
      .then((r) => r.json())
      .then((data) => {
        setStatuses(data.statuses || [])
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load project statuses')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Project Status
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white/5 border border-red-500/20 p-6">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Project Status
      </h3>

      {statuses.length === 0 ? (
        <p className="text-slate-500 text-sm">
          No project statuses yet. They will appear after meetings are processed.
        </p>
      ) : (
        <div className="space-y-3">
          {statuses.map((ps) => (
            <div
              key={ps.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {ps.projectName}
                  </span>
                  <ProjectStatusBadge status={ps.status} />
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{ps.summary}</p>
                {ps.meeting && (
                  <p className="text-xs text-slate-500 mt-1">
                    From: {ps.meeting.title} ·{' '}
                    {new Date(ps.meeting.startTime).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
