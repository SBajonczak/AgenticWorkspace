import { ClientSecretCredential } from '@azure/identity'

/**
 * App-level (daemon) authentication using Client Secret Credentials.
 * Used by the background worker – does NOT require interactive user login.
 *
 * Azure app registration must have APPLICATION permissions (not delegated):
 *   - OnlineMeetings.Read.All
 *   - OnlineMeetingTranscript.Read.All
 *   - Calendars.Read
 * These require admin consent in the Azure portal.
 */
export class AppGraphAuth {
  private credential: ClientSecretCredential

  constructor(tenantId: string, clientId: string, clientSecret: string) {
    this.credential = new ClientSecretCredential(tenantId, clientId, clientSecret)
  }

  async getAccessToken(): Promise<string> {
    const token = await this.credential.getToken('https://graph.microsoft.com/.default')
    if (!token?.token) {
      throw new Error('Failed to acquire app access token from Azure')
    }
    return token.token
  }
}

export function createAppGraphAuth(): AppGraphAuth {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Azure app credentials. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.'
    )
  }

  return new AppGraphAuth(tenantId, clientId, clientSecret)
}
