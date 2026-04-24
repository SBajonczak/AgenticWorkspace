import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

export interface Meeting {
  id: string
  subject: string
  organizer: {
    emailAddress: {
      name: string
      address: string
    }
  }
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  joinWebUrl?: string
  isOnlineMeeting?: boolean
  onlineMeetingUrl?: string
  onlineMeeting?: OnlineMeeting
  onlineMeetingId?: string
  /** ISO string from Graph API lastModifiedDateTime for this calendar event */
  lastModifiedDateTime?: string
  participants?: string[]  // Array of attendee emails (including organizer)
  metadata?: {
    organizerUpn?: string
    attendeeUpns: string[]
    responseStatus?: string
    meetingCode?: string | null
    meetingType?: string | null
    iCalUId?: string | null
    startDateTime?: string
    endDateTime?: string
    allowTranscription?: boolean
    meetingOptionsWebUrl?: string | null
  }
}

export class OnlineMeeting {
  joinUrl?: string;
  conferenceId?: string;
  tollNumber?: string;
}

export class MeetingsClient {
  private client: Client
  // When set, use /users/{userId}/ instead of /me/ (required for app permissions)
  private userPath: string
  private debugRequests: boolean

  constructor(accessToken: string, userId?: string) {
    this.client = Client.init({
      authProvider: (done: (error: Error | null, token?: string | null) => void) => {
        done(null, accessToken)
      },
    })
    // userId can be UPN (email) or Azure AD object ID
    this.userPath = userId ? `/users/${userId}` : '/me'
    this.debugRequests = process.env.DEBUG_GRAPH_MEETINGS !== 'false'
  }

  private logGraphRequest(label: string, path: string, query?: Record<string, string>): void {
    if (!this.debugRequests) return

    const url = new URL(`https://graph.microsoft.com/v1.0${path}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value)
      }
    }

    console.log(`[Graph][Meetings] ${label}`)
    console.log(`[Graph][Meetings] REST: ${url.toString()}`)
    console.log(`[Graph][Meetings] Graph Explorer: GET ${url.pathname}${url.search}`)
  }

  private isOnlineMeetingNotFoundError(error: unknown): boolean {
    const err = error as { statusCode?: number; code?: string; message?: string; body?: string }
    const body = typeof err?.body === 'string' ? err.body : ''
    return (
      err?.statusCode === 404 &&
      (err?.code === 'NotFound' ||
        err?.message?.includes('3004') === true ||
        body.includes('3004: Specified meeting is not found'))
    )
  }

  private formatGraphErrorForLog(error: unknown): string {
    const err = error as { statusCode?: number; code?: string; requestId?: string; message?: string }
    const status = err?.statusCode ?? 'unknown'
    const code = err?.code ?? 'unknown'
    const requestId = err?.requestId ?? 'n/a'
    const message = err?.message ?? 'unknown error'
    return `status=${status} code=${code} requestId=${requestId} message=${message}`
  }

  async getRecentMeetings(limit: number = 10, options?: {
    /** Only return calendar events whose start is >= this date (delta-sync checkpoint). */
    startAfter?: Date
    /** How many days back to look when no startAfter checkpoint is available (default: 30). */
    daysBack?: number
    /** How many days forward to look for upcoming meetings (default: 14). */
    daysForward?: number
    /** Re-fetch a safety overlap before startAfter to avoid missing late/updated items (default: 0). */
    overlapHours?: number
  }): Promise<Meeting[]> {
    try {
      const requestedLimit = Math.max(1, limit)
      const now = new Date()
      const daysBack = options?.daysBack ?? 30
      const daysForward = options?.daysForward ?? 14
      const overlapHours = Math.max(0, options?.overlapHours ?? 0)
      const startDate = options?.startAfter
        ? new Date(options.startAfter.getTime() - overlapHours * 60 * 60 * 1000)
        : new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
      const endDate = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000)

      const startDateTime = startDate.toISOString()
      const endDateTime = endDate.toISOString()

      this.logGraphRequest(`${this.userPath}/calendarView`, `${this.userPath}/calendarView`, {
        startDateTime,
        endDateTime,
        '$top': '100',
        '$orderby': 'start/dateTime DESC',
      })

      const meetings: Meeting[] = []
      let nextPagePath: string | null = `${this.userPath}/calendarView`
      let isFirstPage = true

      while (nextPagePath && meetings.length < requestedLimit) {
        const pageResponse: any = isFirstPage
          ? await this.client
              .api(nextPagePath)
              .query({
                startDateTime,
                endDateTime,
              })
              .select('subject,id,organizer,start,end,isOnlineMeeting,onlineMeetingUrl,attendees,responseStatus,lastModifiedDateTime')
              .top(100)
              .orderby('start/dateTime DESC')
              .get()
          : await this.client
              .api(nextPagePath)
              .get()

        const pageMeetings = (pageResponse.value || []) as Meeting[]
        meetings.push(...pageMeetings)

        const pageNextLink: string | undefined = (pageResponse as { '@odata.nextLink'?: string })['@odata.nextLink']
        nextPagePath = pageNextLink ?? null
        isFirstPage = false
      }

      const slicedMeetings = meetings.slice(0, requestedLimit)

      const enrichedMeetings = await Promise.all(
        slicedMeetings.map(async (meeting: Meeting) => {
          let joinUrl: string | null = null
          let onlineMeetingLookupReason: 'not-found' | 'other-error' | null = null

          if (meeting.isOnlineMeeting) {
            try {
              this.logGraphRequest(
                `${this.userPath}/events/${meeting.id}`,
                `${this.userPath}/events/${meeting.id}`,
                { '$select': 'onlineMeeting' }
              )
              const eventDetails = await this.client
                .api(`${this.userPath}/events/${meeting.id}`)
                .select('onlineMeeting')
                .get()
              joinUrl = eventDetails.onlineMeeting?.joinUrl || meeting.onlineMeetingUrl || null
            } catch (error) {
              console.warn(`Could not get online meeting ID for "${meeting.subject}"`)
              joinUrl = meeting.onlineMeetingUrl || null
            }
          }

          let onlineMeetingId = null
          if (joinUrl) {
            try {
              const escapedJoinUrl = joinUrl.replace(/'/g, "''")
              const filter = `JoinWebUrl eq '${escapedJoinUrl}'`
              this.logGraphRequest(`${this.userPath}/onlineMeetings`, `${this.userPath}/onlineMeetings`, { '$filter': filter })
              const onlineMeetingResponse = await this.client
                .api(`${this.userPath}/onlineMeetings`)
                .filter(filter)
                .get()
              if (onlineMeetingResponse.value?.length > 0) {
                onlineMeetingId = onlineMeetingResponse.value[0].id
              }
            } catch (error) {
              if (this.isOnlineMeetingNotFoundError(error)) {
                onlineMeetingLookupReason = 'not-found'
                console.warn(
                  `[Graph][Meetings] onlineMeeting lookup skipped for "${meeting.subject}" (${meeting.id}): not found in /onlineMeetings (often private/self appointment).`
                )
              } else {
                onlineMeetingLookupReason = 'other-error'
                console.error(
                  `[Graph][Meetings] onlineMeeting lookup failed for "${meeting.subject}" (${meeting.id}): ${this.formatGraphErrorForLog(error)}`
                )
              }
            }
          }

          let onlineMeetingDetails: any = null
          if (onlineMeetingId) {
            try {
              this.logGraphRequest(
                `${this.userPath}/onlineMeetings/${onlineMeetingId}`,
                `${this.userPath}/onlineMeetings/${onlineMeetingId}`,
                {
                  '$select':
                    'id,subject,joinWebUrl,participants,startDateTime,endDateTime,allowTranscription,meetingCode,meetingType,meetingOptionsWebUrl,iCalUId',
                }
              )
              onlineMeetingDetails = await this.client
                .api(`${this.userPath}/onlineMeetings/${onlineMeetingId}`)
                .select(
                  'id,subject,joinWebUrl,participants,startDateTime,endDateTime,allowTranscription,meetingCode,meetingType,meetingOptionsWebUrl,iCalUId'
                )
                .get()
            } catch (error) {
              console.warn(`Could not load online meeting details for "${meeting.subject}" (${onlineMeetingId})`)
            }
          }

          // Collect participant emails from attendees + organizer
          const attendeeEmails: string[] = []
          if (meeting.organizer?.emailAddress?.address) {
            attendeeEmails.push(meeting.organizer.emailAddress.address.toLowerCase())
          }
          if (Array.isArray((meeting as any).attendees)) {
            for (const attendee of (meeting as any).attendees) {
              const email = attendee?.emailAddress?.address
              if (email && !attendeeEmails.includes(email.toLowerCase())) {
                attendeeEmails.push(email.toLowerCase())
              }
            }
          }

          const organizerUpn = onlineMeetingDetails?.participants?.organizer?.upn?.toLowerCase()
          if (organizerUpn && !attendeeEmails.includes(organizerUpn)) {
            attendeeEmails.push(organizerUpn)
          }

          const onlineAttendeeUpns: string[] =
            Array.isArray(onlineMeetingDetails?.participants?.attendees)
              ? onlineMeetingDetails.participants.attendees
                  .map((attendee: any) => attendee?.upn?.toLowerCase())
                  .filter((upn: string | undefined): upn is string => Boolean(upn))
              : []

          for (const upn of onlineAttendeeUpns) {
            if (!attendeeEmails.includes(upn)) {
              attendeeEmails.push(upn)
            }
          }

          if (!onlineMeetingId) {
            const reasonSuffix =
              onlineMeetingLookupReason === 'not-found'
                ? ' (private/self appointment or no onlineMeeting resource)'
                : onlineMeetingLookupReason === 'other-error'
                  ? ' (lookup failed)'
                  : ''
            console.warn(`Skipping "${meeting.subject}" – could not resolve online meeting ID (no transcript available)${reasonSuffix}`)
            return null
          }

          const responseStatus = (meeting as any)?.responseStatus?.response

          return {
            ...meeting,
            id: onlineMeetingId,
            joinWebUrl:
              onlineMeetingDetails?.joinWebUrl ||
              meeting.onlineMeetingUrl ||
              joinUrl ||
              undefined,
            onlineMeetingId: onlineMeetingId,
            lastModifiedDateTime: (meeting as any).lastModifiedDateTime,
            organizer:
              organizerUpn && meeting.organizer?.emailAddress
                ? {
                    emailAddress: {
                      name: meeting.organizer.emailAddress.name,
                      address: organizerUpn,
                    },
                  }
                : meeting.organizer,
            participants: attendeeEmails,
            metadata: {
              organizerUpn,
              attendeeUpns: onlineAttendeeUpns,
              responseStatus,
              meetingCode: onlineMeetingDetails?.meetingCode ?? null,
              meetingType: onlineMeetingDetails?.meetingType ?? null,
              iCalUId: onlineMeetingDetails?.iCalUId ?? null,
              startDateTime: onlineMeetingDetails?.startDateTime,
              endDateTime: onlineMeetingDetails?.endDateTime,
              allowTranscription: onlineMeetingDetails?.allowTranscription,
              meetingOptionsWebUrl: onlineMeetingDetails?.meetingOptionsWebUrl ?? null,
            },
          }
        })
      )

      const resolvedMeetings = enrichedMeetings.filter((m): m is NonNullable<typeof m> => m !== null)
      return resolvedMeetings as any[]
    } catch (error) {
      console.error('Failed to fetch meetings:', error)
      throw error
    }
  }

  async getMeetingById(meetingId: string): Promise<Meeting> {
    try {
      const meeting = await this.client
        .api(`${this.userPath}/onlineMeetings/${meetingId}`)
        .get()

      return meeting
    } catch (error) {
      console.error(`Failed to fetch meeting ${meetingId}:`, error)
      throw error
    }
  }

  async getLatestMeeting(options?: Parameters<MeetingsClient['getRecentMeetings']>[1]): Promise<Meeting[] | null> {
    const meetings = await this.getRecentMeetings(200, options)
    return meetings.length > 0 ? meetings : null
  }
}
