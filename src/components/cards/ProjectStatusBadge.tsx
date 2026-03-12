interface ProjectStatusBadgeProps {
  status: string
  showLabel?: boolean
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  on_track: {
    label: 'On Track',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15 border-emerald-500/30',
    dotColor: 'bg-emerald-400',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15 border-blue-500/30',
    dotColor: 'bg-blue-400',
  },
  at_risk: {
    label: 'At Risk',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15 border-amber-500/30',
    dotColor: 'bg-amber-400',
  },
  blocked: {
    label: 'Blocked',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15 border-red-500/30',
    dotColor: 'bg-red-400',
  },
  completed: {
    label: 'Completed',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/15 border-slate-500/30',
    dotColor: 'bg-slate-400',
  },
}

export function ProjectStatusBadge({ status, showLabel = true }: ProjectStatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/15 border-slate-500/30',
    dotColor: 'bg-slate-400',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {showLabel && config.label}
    </span>
  )
}
