import { DeviceCodeCredential, DeviceCodePromptCallback } from '@azure/identity'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface TokenCacheData {
  accessToken: string
  refreshToken?: string
  expiresOn: number
}

export class TokenCache {
  private cachePath: string

  constructor(cachePath?: string) {
    this.cachePath = cachePath || join(process.cwd(), '.token-cache', 'tokens.json')
  }

  load(): TokenCacheData | null {
    try {
      if (!existsSync(this.cachePath)) {
        return null
      }
      const data = readFileSync(this.cachePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Failed to load token cache:', error)
      return null
    }
  }

  save(data: TokenCacheData): void {
    try {
      const dir = join(this.cachePath, '..')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.cachePath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Failed to save token cache:', error)
    }
  }

  clear(): void {
    try {
      if (existsSync(this.cachePath)) {
        const { unlinkSync } = require('fs')
        unlinkSync(this.cachePath)
      }
    } catch (error) {
      console.error('Failed to clear token cache:', error)
    }
  }
}

export interface GraphAuthConfig {
  tenantId: string
  clientId: string
  scopes?: string[]
}

export class GraphAuth {
  private config: GraphAuthConfig
  private tokenCache: TokenCache
  private credential: DeviceCodeCredential

  constructor(config: GraphAuthConfig, tokenCache?: TokenCache) {
    this.config = config
    this.tokenCache = tokenCache || new TokenCache()
    
    // Initialize DeviceCodeCredential with device code prompt callback
    const promptCallback: DeviceCodePromptCallback = (info) => {
      console.log('\n' + '='.repeat(70))
      console.log('🔐 DEVICE CODE AUTHENTICATION REQUIRED')
      console.log('='.repeat(70))
      console.log(`\n${info.message}\n`)
      console.log(`📱 User Code: ${info.userCode}`)
      console.log(`🌐 Verification URI: ${info.verificationUri}`)
      console.log('\n⏳ Waiting for authentication... (timeout: 5 minutes)')
      console.log('='.repeat(70) + '\n')
    }

    this.credential = new DeviceCodeCredential({
      tenantId: this.config.tenantId,
      clientId: this.config.clientId,
      userPromptCallback: promptCallback,
    })
  }

  async getAccessToken(): Promise<string> {
    // Try to load from cache first
    const cached = this.tokenCache.load()
    if (cached && cached.expiresOn > Date.now()) {
      console.log('Using cached token')
      return cached.accessToken
    }

    // Get new token from Azure with error handling and retries
    const scopes = this.config.scopes || [
      'https://graph.microsoft.com/.default',
      'offline_access',
    ]
    
    console.log('Requesting new token with scopes:', scopes)
    console.log('\nDevice Code Flow initiated. Please complete the authentication in your browser.')
    console.log('If no browser opened, visit the verification URI shown above and enter the user code.\n')

    let tokenResponse
    let lastError: Error | null = null
    const maxRetries = 3
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Token acquisition attempt ${attempt}/${maxRetries}...`)
        tokenResponse = await this.getTokenWithTimeout(scopes, 300000) // 5 minutes timeout
        break
      } catch (error) {
        lastError = error as Error
        console.error(`Attempt ${attempt} failed:`, lastError.message)
        
        if (attempt < maxRetries) {
          console.log(`Retrying in 2 seconds...`)
          await this.delay(2000)
        }
      }
    }
    
    if (!tokenResponse) {
      const errorMsg = `Failed to acquire token after ${maxRetries} attempts. ${lastError?.message || 'Device code authentication failed.'}`
      console.error('\n' + errorMsg)
      throw new Error(errorMsg)
    }

    // Cache the token
    this.tokenCache.save({
      accessToken: tokenResponse.token,
      expiresOn: tokenResponse.expiresOnTimestamp,
    })

    console.log('✓ Token acquired and cached')
    return tokenResponse.token
  }

  private async getTokenWithTimeout(
    scopes: string[],
    timeoutMs: number
  ): Promise<{ token: string; expiresOnTimestamp: number }> {
    return Promise.race([
      this.credential.getToken(scopes),
      new Promise<{ token: string; expiresOnTimestamp: number }>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Token acquisition timeout after ${timeoutMs / 1000}s. Please complete the device code authentication.`)),
          timeoutMs
        )
      ),
    ])
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  clearCache(): void {
    this.tokenCache.clear()
  }
}

export function createGraphAuth(): GraphAuth {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID

  if (!tenantId || !clientId) {
    throw new Error('Missing Azure configuration. Set AZURE_TENANT_ID and AZURE_CLIENT_ID.')
  }

  console.log('Initializing GraphAuth with tenant and client ID')

  return new GraphAuth({
    tenantId,
    clientId,
    scopes: [
      'OnlineMeetings.Read',
      'OnlineMeetingTranscript.Read.All',
      'offline_access',
    ],
  })
}
