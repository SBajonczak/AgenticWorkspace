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

  constructor(accessToken: string, userId?: string) {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      },
    })
    // userId can be UPN (email) or Azure AD object ID
    this.userPath = userId ? `/users/${userId}` : '/me'
  }

  async getRecentMeetings(limit: number = 10, options?: {
    /** Only return calendar events whose start is >= this date (delta-sync checkpoint). */
    startAfter?: Date
    /** How many days back to look when no startAfter checkpoint is available (default: 30). */
    daysBack?: number
    /** How many days forward to look for upcoming meetings (default: 14). */
    daysForward?: number
  }): Promise<Meeting[]> {
    try {
      const now = new Date()
      const daysBack = options?.daysBack ?? 30
      const daysForward = options?.daysForward ?? 14
      const startDate = options?.startAfter
        ? new Date(options.startAfter.getTime() - 60 * 60 * 1000) // 1h buffer for overlap
        : new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
      const endDate = new Date(now.getTime() + daysForward * 24 * 60 * 60 * 1000)

      const startDateTime = startDate.toISOString()
      const endDateTime = endDate.toISOString()

      const response = await this.client
        .api(`${this.userPath}/calendarView`)
        .query({
          startDateTime: startDateTime,
          endDateTime: endDateTime,
        })
        .select('subject,id,organizer,start,end,isOnlineMeeting,onlineMeetingUrl,attendees,responseStatus,lastModifiedDateTime')
        .top(100)
        .orderby('start/dateTime DESC')
        .get()

      const meetings = response.value || []

      const enrichedMeetings = await Promise.all(
        meetings.map(async (meeting: Meeting) => {
          let joinUrl: string | null = null

          if (meeting.isOnlineMeeting) {
            try {
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
              const onlineMeetingResponse = await this.client
                .api(`${this.userPath}/onlineMeetings`)
                .filter(filter)
                .get()
              if (onlineMeetingResponse.value?.length > 0) {
                onlineMeetingId = onlineMeetingResponse.value[0].id
              }
            } catch (error) {
              console.error(`Error fetching online meeting for "${meeting.subject}":`, error)
            }
          }

          let onlineMeetingDetails: any = null
          if (onlineMeetingId) {
            try {
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
            console.warn(`Skipping "${meeting.subject}" – could not resolve online meeting ID (no transcript available)`)
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
    const meetings = await this.getRecentMeetings(20, options)
    return meetings.length > 0 ? meetings : null
  }
}
