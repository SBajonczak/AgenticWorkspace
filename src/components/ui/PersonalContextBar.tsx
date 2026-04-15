'use client'

import { DashboardUserProfile } from '@/types/user'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface PersonalContextBarProps {
  user: DashboardUserProfile
}

export default function PersonalContextBar({ user }: PersonalContextBarProps) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10 border border-primary/40">
        <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name || 'Profile picture'} />
        <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
          {user.initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{user.name}</span>
        {user.role && (
          <>
            <span className="text-border">·</span>
            <span>{user.role}</span>
          </>
        )}
        {user.location && (
          <>
            <span className="text-border">·</span>
            <span>{user.location}</span>
          </>
        )}
      </div>
    </div>
  )
}
