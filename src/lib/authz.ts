import { prisma } from '@/db/prisma'
import { auth } from './auth'
import { NextResponse } from 'next/server'

type AuthenticatedSession = {
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
}

async function hydrateTenantIdFromAzureTenant(session: AuthenticatedSession): Promise<AuthenticatedSession> {
  if (session.user.tenantId || !session.user.azureTid) {
    return session
  }

  const tenant = await prisma.tenant.findUnique({
    where: { azureTenantId: session.user.azureTid },
    select: { id: true },
  })

  if (!tenant?.id) {
    return session
  }

  session.user.tenantId = tenant.id

  if (session.user.id) {
    try {
      await prisma.user.updateMany({
        where: { id: session.user.id, tenantId: null },
        data: { tenantId: tenant.id },
      })
    } catch (persistError) {
      console.warn('[authz] Failed to backfill user tenantId from azureTid', persistError)
    }
  }

  return session
}

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
      session: AuthenticatedSession
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

  const hydratedSession = await hydrateTenantIdFromAzureTenant(session as AuthenticatedSession)

  return {
    session: hydratedSession,
    error: null,
  }
}

/**
 * Server-side guard that checks both authentication and meeting participation.
 * Returns a 401 if not authenticated, 403 if not a participant.
 */
export async function requireProjectAdmin(): Promise<
  | {
      session: AuthenticatedSession
      error: null
    }
  | { session: null; error: NextResponse }
> {
  const authResult = await requireAuth()
  if (authResult.error) return authResult

  if (!isProjectAdmin(authResult.session)) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return authResult
}

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

/**
 * Requires the authenticated user to belong to the same tenant as the meeting.
 * This is a looser check than requireMeetingParticipant and enables tenant-wide
 * collaboration: any tenant member can view any meeting in their organization.
 */
export async function requireTenantMember(
  internalMeetingId: string
): Promise<
  | { session: AuthenticatedSession; error: null }
  | { session: null; error: NextResponse }
> {
  const authResult = await requireAuth()
  if (authResult.error) return authResult

  const userTenantId = authResult.session!.user.tenantId
  if (!userTenantId) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden: No tenant association.' }, { status: 403 }),
    }
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: internalMeetingId },
    select: { tenantId: true },
  })

  if (!meeting) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Not found.' }, { status: 404 }),
    }
  }

  if (meeting.tenantId !== userTenantId) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden: Meeting belongs to a different tenant.' }, { status: 403 }),
    }
  }

  return authResult
}
