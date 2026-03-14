import { prisma } from '../db/prisma'
import { UserSyncStateRepository } from '../db/repositories/userSyncStateRepository'

const TOKEN_EXPIRY_SAFETY_WINDOW_SECONDS = 120

export class ReauthRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReauthRequiredError'
  }
}

export class MissingAccountTokenError extends ReauthRequiredError {
  constructor() {
    super('No Microsoft account token state found. Please sign in again with consent.')
    this.name = 'MissingAccountTokenError'
  }
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type?: string
}

export class UserTokenService {
  private syncStateRepository: UserSyncStateRepository

  constructor(syncStateRepository = new UserSyncStateRepository()) {
    this.syncStateRepository = syncStateRepository
  }

  async getValidAccessTokenForUser(userId: string): Promise<string> {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'microsoft-entra-id',
      },
    })

    if (!account) {
      await this.syncStateRepository.setTokenState(userId, false, true)
      throw new MissingAccountTokenError()
    }

    const hasRefreshToken = Boolean(account.refresh_token)
    await this.syncStateRepository.setTokenState(userId, hasRefreshToken, false)

    if (account.access_token && account.expires_at && account.expires_at > this.expiresAtWithSafetyWindow()) {
      return account.access_token
    }

    if (!account.refresh_token) {
      await this.syncStateRepository.setTokenState(userId, false, true)
      throw new ReauthRequiredError('Microsoft refresh token missing. Please sign in again with consent.')
    }

    const refreshed = await this.refreshAccessToken(account.refresh_token)
    const nextExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? account.refresh_token,
        expires_at: nextExpiresAt,
        token_type: refreshed.token_type ?? account.token_type,
        scope: refreshed.scope ?? account.scope,
      },
    })

    await this.syncStateRepository.setTokenState(userId, true, false)
    return refreshed.access_token
  }

  private expiresAtWithSafetyWindow(): number {
    return Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SAFETY_WINDOW_SECONDS
  }

  private async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const tenantId = process.env.AZURE_TENANT_ID
    const clientId = process.env.AZURE_CLIENT_ID
    const clientSecret = process.env.AZURE_CLIENT_SECRET

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('Missing Azure OAuth configuration for delegated token refresh.')
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: [
        'openid',
        'profile',
        'email',
        'offline_access',
        'User.Read',
        'Calendars.Read',
        'OnlineMeetings.Read',
        'OnlineMeetingTranscript.Read.All',
      ].join(' '),
    })

    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({})) as { error?: string; error_description?: string }
      const errorCode = errorPayload.error ?? 'unknown_error'
      const errorMessage = errorPayload.error_description ?? 'Token refresh failed'
      if (['invalid_grant', 'interaction_required', 'consent_required'].includes(errorCode)) {
        throw new ReauthRequiredError(`Re-consent required: ${errorMessage}`)
      }
      throw new Error(`Token refresh failed (${errorCode}): ${errorMessage}`)
    }

    return response.json() as Promise<TokenResponse>
  }
}
