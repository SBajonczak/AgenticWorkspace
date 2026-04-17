export interface DashboardUserProfile {
  id: string
  name: string
  email: string | null
  role: string | null
  location: string | null
  initials: string
  avatarUrl: string | null
  appRoles?: string[]
}
