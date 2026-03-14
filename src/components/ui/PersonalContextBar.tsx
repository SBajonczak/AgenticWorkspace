'use client'

import { useState } from 'react'
import { DashboardUserProfile } from '@/types/user'

interface PersonalContextBarProps {
  user: DashboardUserProfile
}

export default function PersonalContextBar({ user }: PersonalContextBarProps) {
  const [isAvatarBroken, setIsAvatarBroken] = useState(false)
  const showAvatarImage = Boolean(user.avatarUrl) && !isAvatarBroken

  return (
    <div className="flex items-center gap-3">
      {/* Avatar with image fallback */}
      {showAvatarImage ? (
        <img
          src={user.avatarUrl ?? undefined}
          alt={user.name || 'Profile picture'}
          className="w-10 h-10 rounded-full object-cover border border-purple-500/40"
          onError={() => setIsAvatarBroken(true)}
        />
      ) : (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold text-sm">
          {user.initials}
        </div>
      )}
      
      {/* User info */}
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <span className="font-semibold text-white">{user.name}</span>
        {user.role && (
          <>
            <span className="text-gray-500">·</span>
            <span>{user.role}</span>
          </>
        )}
        {user.location && (
          <>
            <span className="text-gray-500">·</span>
            <span>{user.location}</span>
          </>
        )}
      </div>
    </div>
  )
}
