import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'

export interface TranscriptContent {
  text: string
  speaker?: string
  timestamp?: string
}

export class TranscriptsClient {
  private client: Client

  constructor(accessToken: string) {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      },
    })
  }

  async getTranscript(meetingId: string): Promise<string | null> {
    try {
      // Get list of transcripts for the meeting
      const transcriptsResponse = await this.client
        .api(`/me/onlineMeetings/${meetingId}/transcripts`)
        .get()

      const transcripts = transcriptsResponse.value || []
      
      if (transcripts.length === 0) {
        console.log(`No transcripts found for meeting ${meetingId}`)
        return null
      }

      // Get the most recent transcript
      const latestTranscript = transcripts[0]
      const transcriptId = latestTranscript.id

      // Download transcript content
      const contentResponse = await this.client
        .api(`/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`)
        .get()

      return this.parseTranscriptContent(contentResponse)
    } catch (error) {
      console.error(`Failed to fetch transcript for meeting ${meetingId}:`, error)
      return null
    }
  }

  private parseTranscriptContent(content: any): string {
    // Handle different transcript formats from Microsoft Graph
    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      // Parse VTT or similar format
      return content
        .map((item: TranscriptContent) => {
          const speaker = item.speaker || 'Unknown'
          const text = item.text || ''
          const timestamp = item.timestamp || ''
          return `[${timestamp}] ${speaker}: ${text}`
        })
        .join('\n')
    }

    // Fallback: stringify
    return JSON.stringify(content, null, 2)
  }

  async hasTranscript(meetingId: string): Promise<boolean> {
    try {
      const transcriptsResponse = await this.client
        .api(`/me/onlineMeetings/${meetingId}/transcripts`)
        .get()

      const transcripts = transcriptsResponse.value || []
      return transcripts.length > 0
    } catch (error) {
      console.error(`Failed to check transcript for meeting ${meetingId}:`, error)
      return false
    }
  }
}
