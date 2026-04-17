import { prisma } from '@/db/prisma'
import { auth } from './auth'
import { NextResponse } from 'next/server'

/**
 * Checks whether the currently authenticated user is a participant
 * (attendee or organizer) of the given meeting.
 *
 * Returns true if the user has access, false otherwise.
 */
export async function isMeetingParticipant(meetingId: string, userEmail: string): Promise<boolean> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { participants: true, organizerEmail: true },
  })

  if (!meeting) return false

  const email = userEmail.toLowerCase()

  // Check organizer
  if (meeting.organizerEmail && meeting.organizerEmail.toLowerCase() === email) {
    return true
  }

  // Check participants list
  if (meeting.participants) {
    try {
      const participants: string[] = JSON.parse(meeting.participants)
      return participants.map((p) => p.toLowerCase()).includes(email)
    } catch {
      return false
    }
  }

  return false
}

/**
 * Returns true if the session user has the 'projectadmin' Azure AD App Role.
 */
export function isProjectAdmin(session: { user?: { appRoles?: string[] } } | null): boolean {
  return session?.user?.appRoles?.includes('projectadmin') === true
}

/**
 * Server-side guard for API routes. Returns the session or a 401/403 response.
 *
 * Usage in a route handler:
 *   const { session, error } = await requireAuth()
 *   if (error) return error
 */
export async function requireAuth(): Promise<
  | {
      session: {
        user: {
          id: string
          email: string
          name?: string | null
          tenantId?: string
          aadObjectId?: string
          azureTid?: string
          appRoles?: string[]
        }
      }
      error: null
    }
  | { session: null; error: NextResponse }
> {
  const session = await auth()

  if (!session?.user?.email) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return {
    session: session as {
      user: {
        id: string
        email: string
        name?: string | null
        tenantId?: string
        aadObjectId?: string
        azureTid?: string
        appRoles?: string[]
      }
      msGraphConsentRequired?: boolean
    },
    error: null,
  }
}

/**
 * Server-side guard that checks both authentication and meeting participation.
 * Returns a 401 if not authenticated, 403 if not a participant.
 */
export async function requireMeetingParticipant(
  internalMeetingId: string
): Promise<
  | { session: { user: { id: string; email: string; name?: string | null } }; error: null }
  | { session: null; error: NextResponse }
> {
  const authResult = await requireAuth()
  if (authResult.error) return authResult

  const hasAccess = await isMeetingParticipant(internalMeetingId, authResult.session!.user.email)

  if (!hasAccess) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Forbidden: You are not a participant of this meeting.' },
        { status: 403 }
      ),
    }
  }

  return authResult
}
