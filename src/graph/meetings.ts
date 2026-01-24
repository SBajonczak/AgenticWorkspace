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
      const response = await this.client
        .api('/me/onlineMeetings')
        .top(limit)
        .orderby('startDateTime desc')
        .get()

      return response.value || []
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

  async getLatestMeeting(): Promise<Meeting | null> {
    const meetings = await this.getRecentMeetings(1)
    return meetings.length > 0 ? meetings[0] : null
  }
}
