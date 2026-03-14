'use client'

import { useEffect, useState } from 'react'
import { ProjectStatusBadge } from '../cards/ProjectStatusBadge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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
      <Card className="rounded-2xl">
        <CardHeader>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Project Status
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="rounded-2xl border-destructive/20">
        <CardContent className="py-4">
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Project Status
        </p>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No project statuses yet. They will appear after meetings are processed.
          </p>
        ) : (
          <div className="space-y-3">
            {statuses.map((ps) => (
              <div
                key={ps.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-muted/5 hover:bg-muted/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground truncate">
                      {ps.projectName}
                    </span>
                    <ProjectStatusBadge status={ps.status} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{ps.summary}</p>
                  {ps.meeting && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      From: {ps.meeting.title} ·{' '}
                      {new Date(ps.meeting.startTime).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
