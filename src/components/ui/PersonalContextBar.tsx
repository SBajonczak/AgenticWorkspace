'use client'

import { User } from '@/mocks'

interface PersonalContextBarProps {
  user: User
}

export default function PersonalContextBar({ user }: PersonalContextBarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Avatar with initials */}
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold text-sm">
        {user.initials}
      </div>
      
      {/* User info */}
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <span className="font-semibold text-white">{user.name}</span>
        <span className="text-gray-500">·</span>
        <span>{user.role}</span>
        <span className="text-gray-500">·</span>
        <span>{user.location}</span>
      </div>
    </div>
  )
}
