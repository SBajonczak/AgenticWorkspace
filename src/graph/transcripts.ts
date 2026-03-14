import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

export interface TranscriptContent {
  text: string
  speaker?: string
  timestamp?: string
}

export class TranscriptsClient {
  private client: Client
  private accessToken: string
  // When set, use /users/{userId}/ instead of /me/ (required for app permissions)
  private userPath: string

  constructor(accessToken: string, userId?: string) {
    this.accessToken = accessToken
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      },
    })
    this.userPath = userId ? `/users/${userId}` : '/me'
  }

  async getTranscript(meetingId: string): Promise<string | null> {
    try {
      const transcriptsResponse = await this.client
        .api(`${this.userPath}/onlineMeetings/${meetingId}/transcripts`)
        .get()

      const transcripts = transcriptsResponse.value || []

      if (transcripts.length === 0) {
        console.log(`No transcripts found for meeting ${meetingId}`)
        return null
      }

      const latestTranscript = transcripts[0]
      const transcriptContentUrl = latestTranscript.transcriptContentUrl
      const transcriptId = latestTranscript.id

      if (transcriptContentUrl) {
        try {
          const vttResponse = await fetch(transcriptContentUrl, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              Accept: 'text/vtt',
            },
          })

          if (vttResponse.ok) {
            return await vttResponse.text()
          }

          console.warn(
            `Fetching transcriptContentUrl failed (${vttResponse.status}) for meeting ${meetingId}. Falling back to /content endpoint.`
          )
        } catch (error) {
          console.warn(`Fetching transcriptContentUrl failed for meeting ${meetingId}. Falling back to /content endpoint.`, error)
        }
      }

      const contentResponse = await this.client
        .api(`${this.userPath}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`)
        .header('Accept', 'text/vtt')
        .get()

      return this.parseTranscriptContent(contentResponse)
    } catch (error) {
      const err = error as { statusCode?: number; code?: string; message?: string }
      if (err?.statusCode === 403) {
        console.warn(
          `Transcript access denied for meeting ${meetingId}. ` +
            `Check delegated Graph scopes (OnlineMeetingTranscript.Read.All, OnlineMeetings.Read, Calendars.Read), ` +
            `admin consent, and whether the signed-in user has access to this meeting.`
        )
      } else {
        console.error(`Failed to fetch transcript for meeting ${meetingId}:`, error)
      }
      return null
    }
  }

  private parseTranscriptContent(content: any): string {
    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      return content
        .map((item: TranscriptContent) => {
          const speaker = item.speaker || 'Unknown'
          const text = item.text || ''
          const timestamp = item.timestamp || ''
          return `[${timestamp}] ${speaker}: ${text}`
        })
        .join('\n')
    }

    return JSON.stringify(content, null, 2)
  }

  async hasTranscript(meetingId: string): Promise<boolean> {
    try {
      const transcriptsResponse = await this.client
        .api(`${this.userPath}/onlineMeetings/${meetingId}/transcripts`)
        .get()

      const transcripts = transcriptsResponse.value || []
      return transcripts.length > 0
    } catch (error) {
      console.error(`Failed to check transcript for meeting ${meetingId}:`, error)
      return false
    }
  }
}
