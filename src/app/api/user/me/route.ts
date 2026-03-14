import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UserTokenService } from '@/graph/userTokenService'
import { DashboardUserProfile } from '@/types/user'

interface SessionUserLike {
  id?: string
  name?: string | null
  email?: string | null
  image?: string | null
}

interface GraphProfileResponse {
  displayName?: string
  givenName?: string
  surname?: string
  mail?: string
  userPrincipalName?: string
  jobTitle?: string
  officeLocation?: string
}

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name ?? '').trim()
  if (source.length > 0) {
    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
    }
    return (parts[0] ?? '').slice(0, 2).toUpperCase()
  }

  const fromEmail = (email ?? '').trim()
  if (fromEmail.length > 0) {
    return fromEmail.slice(0, 2).toUpperCase()
  }

  return '??'
}

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionUser = session.user as SessionUserLike
  let graphProfile: GraphProfileResponse | null = null
  let hasGraphToken = false

  if (sessionUser.id) {
    try {
      const userTokenService = new UserTokenService()
      const accessToken = await userTokenService.getValidAccessTokenForUser(sessionUser.id)
      hasGraphToken = true

      const profileResponse = await fetch(
        'https://graph.microsoft.com/v1.0/me?$select=displayName,givenName,surname,mail,userPrincipalName,jobTitle,officeLocation',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        }
      )

      if (profileResponse.ok) {
        graphProfile = (await profileResponse.json()) as GraphProfileResponse
      }
    } catch (error) {
      console.warn('[api/user/me] Falling back to session user data because Graph profile lookup failed', error)
    }
  }

  const name = graphProfile?.displayName ?? sessionUser.name ?? sessionUser.email ?? 'User'
  const email = graphProfile?.mail ?? graphProfile?.userPrincipalName ?? sessionUser.email ?? null
  const role = graphProfile?.jobTitle ?? null
  const location = graphProfile?.officeLocation ?? null
  const initials = getInitials(name, email)

  const result: DashboardUserProfile = {
    id: sessionUser.id ?? '',
    name,
    email,
    role,
    location,
    initials,
    avatarUrl: sessionUser.image ?? (hasGraphToken ? '/api/user/me/photo' : null),
  }

  return NextResponse.json(result)
}
