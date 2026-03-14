import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ProjectStatusBadgeProps {
  status: string
  showLabel?: boolean
}

const statusConfig: Record<string, { label: string; className: string; dotClass: string }> = {
  on_track: {
    label: 'On Track',
    className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
    dotClass: 'bg-emerald-400',
  },
  in_progress: {
    label: 'In Progress',
    className: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
    dotClass: 'bg-blue-400',
  },
  at_risk: {
    label: 'At Risk',
    className: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
    dotClass: 'bg-amber-400',
  },
  blocked: {
    label: 'Blocked',
    className: 'border-red-500/30 bg-red-500/15 text-red-400',
    dotClass: 'bg-red-400',
  },
  completed: {
    label: 'Completed',
    className: 'border-slate-500/30 bg-slate-500/15 text-slate-400',
    dotClass: 'bg-slate-400',
  },
}

export function ProjectStatusBadge({ status, showLabel = true }: ProjectStatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'border-slate-500/30 bg-slate-500/15 text-slate-400',
    dotClass: 'bg-slate-400',
  }

  return (
    <Badge variant="outline" className={cn('gap-1.5', config.className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dotClass)} />
      {showLabel && config.label}
    </Badge>
  )
}
