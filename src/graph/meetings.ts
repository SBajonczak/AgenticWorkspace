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
  participants?: string[]  // Array of attendee emails (including organizer)
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

  async getRecentMeetings(limit: number = 10): Promise<Meeting[]> {
    try {
      const now = new Date()
      const startDate = new Date()
      startDate.setDate(now.getDate() - 14)

      const startDateTime = startDate.toISOString()
      const endDateTime = now.toISOString()

      const response = await this.client
        .api(`${this.userPath}/calendarView`)
        .query({
          startDateTime: startDateTime,
          endDateTime: endDateTime,
        })
        .select('subject,id,organizer,start,end,isOnlineMeeting,onlineMeetingUrl,attendees')
        .top(limit)
        .orderby('start/dateTime DESC')
        .get()

      const meetings = response.value || []

      const enrichedMeetings = await Promise.all(
        meetings.map(async (meeting: Meeting) => {
          let joinUrl = null

          if (meeting.isOnlineMeeting) {
            try {
              const eventDetails = await this.client
                .api(`${this.userPath}/events/${meeting.id}`)
                .select('onlineMeeting')
                .get()
              joinUrl = eventDetails.onlineMeeting?.joinUrl
            } catch (error) {
              console.warn(`Could not get online meeting ID for "${meeting.subject}"`)
            }
          }

          let onlineMeetingId = null
          if (joinUrl) {
            try {
              const filter = `JoinWebUrl eq '${joinUrl}'`
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

          return {
            ...meeting,
            id: onlineMeetingId,
            joinWebUrl: meeting.onlineMeetingUrl || undefined,
            onlineMeetingId: onlineMeetingId,
            participants: attendeeEmails,
          }
        })
      )

      return enrichedMeetings as any[]
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

  async getLatestMeeting(): Promise<Meeting[] | null> {
    const meetings = await this.getRecentMeetings(10)
    return meetings.length > 0 ? meetings : null
  }
}
