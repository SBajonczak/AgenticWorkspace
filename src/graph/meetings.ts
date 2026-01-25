import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'
import { id } from 'zod/v4/locales'

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
}

export class OnlineMeeting {
  joinUrl?: string;
  conferenceId?: string;
  tollNumber?: string;
}

export class MeetingsClient {
  private client: Client

  constructor(accessToken: string) {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      },
    })
  }

  async getRecentMeetings(limit: number = 10): Promise<Meeting[]> {
    try {
      const now = new Date()
      const startDate = new Date()
      startDate.setDate(now.getDate() - 14)

      const startDateTime = startDate.toISOString()
      const endDateTime = now.toISOString()

      const response = await this.client
        .api('/me/calendarView')
        .query({
          startDateTime: startDateTime,
          endDateTime: endDateTime,
        })
        .select('subject,id,organizer,start,end,isOnlineMeeting,onlineMeetingUrl')
        .top(limit)
        .orderby('start/dateTime DESC')
        .get()

      console.log("contentResponse:", JSON.stringify(response, null, 2));

      const meetings = response.value || []

      // Für Online-Meetings: Online Meeting ID abrufen
      const enrichedMeetings = await Promise.all(
        meetings.map(async (meeting: Meeting) => {
          let joinUrl = null

          if (meeting.isOnlineMeeting) {
            try {
              // Abrufe die Event-Details um die onlineMeetingId zu bekommen
              const eventDetails = await this.client
                .api(`/me/events/${meeting.id}`)
                .select('onlineMeeting')
                .get()
              console.log("eventDetails:", JSON.stringify(eventDetails, null, 2));
              joinUrl = eventDetails.onlineMeeting.joinUrl;
              console.log(`📞 Online Meeting ID für "${meeting.subject}": ${joinUrl}`)
            } catch (error) {
              console.warn(`⚠️ Konnte Online Meeting ID für "${meeting.subject}" nicht abrufen`)
            }
          }
          let onlineMeetingId = null;
          console.log(`Fetching online meeting by JoinWebUrl: ${joinUrl}`);
          try {
            const filter = `JoinWebUrl eq '${joinUrl}'`
            const onlineMeetingResponse = await this.client
              .api('/me/onlineMeetings')
              .filter(filter)
              .get()
            console.log("onlineMeetingResponse:", JSON.stringify(onlineMeetingResponse, null, 2));
            if (onlineMeetingResponse.value && onlineMeetingResponse.value.length > 0) {
              onlineMeetingId = onlineMeetingResponse.value[0].id
              console.log(`📞 Online Meeting ID for "${meeting.subject}": ${onlineMeetingId}`)
            } else {
              console.warn(`⚠️ Could not find online meeting for "${meeting.subject}" using JoinWebUrl.`)
            }
          } catch (error) {
            console.error(`Error fetching online meeting by JoinWebUrl for "${meeting.subject}":`, error)
          }
          return {
            ...meeting,
            id:onlineMeetingId,
            joinWebUrl: meeting.onlineMeetingUrl || undefined,
            onlineMeetingId:onlineMeetingId, // Neue Property für Transcript-Abruf
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
        .api(`/me/onlineMeetings/${meetingId}`)
        .get()

      return meeting
    } catch (error) {
      console.error(`Failed to fetch meeting ${meetingId}:`, error)
      throw error
    }
  }

  async getLatestMeeting(): Promise<Meeting[] | null> {
    const meetings = await this.getRecentMeetings(10)
    return meetings.length > 0 ? meetings: null
  }
}
