import { Client } from '@microsoft/microsoft-graph-client'
import 'isomorphic-fetch'
import { UserTokenService, ReauthRequiredError } from './userTokenService'

export interface TranscriptContent {
  text: string
  speaker?: string
  timestamp?: string
}

/**
 * Client for fetching Microsoft Teams meeting transcripts from Graph API.
 * Handles token refresh on 403 errors (access denied due to expired/invalid token).
 */
export class TranscriptsClient {
  //@ts-expect-error this will be initialized in the constructor, but TypeScript doesn't recognize that
  private client: Client
  private accessToken: string
  // Delegated calls must use /me. App-only calls can target /users/{id}.
  private userPath: string
  private userId?: string
  private tokenService?: UserTokenService

  constructor(accessToken: string, userId?: string, tokenService?: UserTokenService) {
    this.accessToken = accessToken
    this.userId = userId
    this.tokenService = tokenService
    this.initializeClient(accessToken)
    this.userPath = tokenService ? '/me' : userId ? `/users/${userId}` : '/me'
  }

  /**
   * Initialize or reinitialize the Graph API client with new token
   */
  private initializeClient(accessToken: string): void {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      },
    })
  }

  /**
   * Fetch transcript for a meeting.
   * Attempts to refresh token on 403 errors if tokenService is available.
   *
   * @throws {ReauthRequiredError} If token refresh fails (missing refresh token)
   * @returns Transcript content as string, or null if not found
   */
  async getTranscript(meetingId: string): Promise<string | null> {
    try {
      return await this.fetchTranscriptInternal(meetingId)
    } catch (error) {
      const err = error as { statusCode?: number; code?: string; message?: string }

      // 403 = Access Denied. Could be expired token or missing delegated permissions.
      // If we have token service, try refreshing the token and retry once.
      if (err?.statusCode === 403 && this.tokenService && this.userId) {
        return await this.handleAccessDeniedAndRetry(meetingId)
      }

      // No retry possible or other error
      this.logTranscriptError(meetingId, err)
      return null
    }
  }

  /**
   * Internal method to fetch transcript from Graph API
   */
  private async fetchTranscriptInternal(meetingId: string): Promise<string | null> {
    const transcriptsResponse = await this.client
      .api(`${this.userPath}/onlineMeetings/${meetingId}/transcripts`)
      .get()

    const transcripts = transcriptsResponse.value || []

    if (transcripts.length === 0) {
      console.log(`No transcripts found for meeting ${meetingId}`)
      return null
    }

    return await this.extractTranscriptContent(meetingId, transcripts[0])
  }

  /**
   * Extract transcript content from the transcript object
   */
  private async extractTranscriptContent(meetingId: string, transcript: any): Promise<string | null> {
    const transcriptContentUrl = transcript.transcriptContentUrl
    const transcriptId = transcript.id

    // Try fetching from transcriptContentUrl first (usually faster)
    if (transcriptContentUrl) {
      const vttContent = await this.fetchFromContentUrl(meetingId, transcriptContentUrl)
      if (vttContent) {
        return vttContent
      }
    }

    // Fall back to /content endpoint
    const contentResponse = await this.client
      .api(`${this.userPath}/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content`)
      .header('Accept', 'text/vtt')
      .get()

    return this.parseTranscriptContent(contentResponse)
  }

  /**
   * Attempt to fetch VTT content from the provided URL
   */
  private async fetchFromContentUrl(meetingId: string, url: string): Promise<string | null> {
    try {
      const vttResponse = await fetch(url, {
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
      console.warn(
        `Fetching transcriptContentUrl failed for meeting ${meetingId}. Falling back to /content endpoint.`,
        error
      )
    }

    return null
  }

  /**
   * Handle 403 error by refreshing token and retrying once
   */
  private async handleAccessDeniedAndRetry(meetingId: string): Promise<string | null> {
    console.warn(
      `Transcript access denied (403) for meeting ${meetingId}. Attempting to refresh token and retry.`
    )

    try {
      // Refresh token using UserTokenService
      const freshToken = await this.tokenService!.getValidAccessTokenForUser(this.userId!)
      this.accessToken = freshToken
      this.initializeClient(freshToken)

      console.log(`Token refreshed successfully for user ${this.userId}. Retrying transcript fetch.`)

      // Retry once with fresh token
      return await this.fetchTranscriptInternal(meetingId)
    } catch (refreshError) {
      // Token refresh failed - propagate the error
      if (refreshError instanceof ReauthRequiredError) {
        console.error(
          `Token refresh failed for user ${this.userId}: ${refreshError.message}. ` +
            `Required Delegated Graph scopes: OnlineMeetingTranscript.Read.All, OnlineMeetings.Read. ` +
            `Admin consent may also be required.`
        )
        throw refreshError
      }

      // Log the refresh error and return null
      console.error(
        `Token refresh failed for user ${this.userId}. Could not retry transcript fetch for meeting ${meetingId}.`,
        refreshError
      )
      return null
    }
  }

  /**
   * Log transcript access error with helpful guidance
   */
  private logTranscriptError(meetingId: string, err: any): void {
    if (err?.statusCode === 403) {
      console.warn(
        `Transcript access denied for meeting ${meetingId}. ` +
          `Verify: (1) Delegated Graph scopes are granted (OnlineMeetingTranscript.Read.All, OnlineMeetings.Read), ` +
          `(2) Admin consent was provided, (3) User has access to this meeting.`
      )
    } else {
      console.error(`Failed to fetch transcript for meeting ${meetingId}:`, err)
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

  /**
   * Check if a meeting has any transcripts available
   */
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
