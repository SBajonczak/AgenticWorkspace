import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// Note: @azure/identity needs to be installed separately for production use
// For demo purposes, we'll create a mock implementation
interface DeviceCodeInfo {
  message: string
  userCode: string
  verificationUri: string
}

class DeviceCodeCredential {
  private tenantId: string
  private clientId: string
  private userPromptCallback?: (info: DeviceCodeInfo) => void

  constructor(config: {
    tenantId: string
    clientId: string
    userPromptCallback?: (info: DeviceCodeInfo) => void
  }) {
    this.tenantId = config.tenantId
    this.clientId = config.clientId
    this.userPromptCallback = config.userPromptCallback
  }

  async getToken(scopes: string[]): Promise<{ token: string; expiresOnTimestamp: number } | null> {
    // In production, this would use the actual @azure/identity package
    // For demo, return mock token
    console.warn('Using mock authentication. Install @azure/identity for production.')
    return {
      token: 'mock-token-' + Date.now(),
      expiresOnTimestamp: Date.now() + 3600000, // 1 hour
    }
  }
}

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
  private credential?: DeviceCodeCredential

  constructor(config: GraphAuthConfig, tokenCache?: TokenCache) {
    this.config = config
    this.tokenCache = tokenCache || new TokenCache()
  }

  async getAccessToken(): Promise<string> {
    // Try to load from cache first
    const cached = this.tokenCache.load()
    if (cached && cached.expiresOn > Date.now()) {
      return cached.accessToken
    }

    // Initialize credential if not already done
    if (!this.credential) {
      this.credential = new DeviceCodeCredential({
        tenantId: this.config.tenantId,
        clientId: this.config.clientId,
        userPromptCallback: (info) => {
          console.log('\n' + '='.repeat(60))
          console.log('DEVICE CODE AUTHENTICATION REQUIRED')
          console.log('='.repeat(60))
          console.log(`\n${info.message}\n`)
          console.log('='.repeat(60) + '\n')
        },
      })
    }

    // Get new token
    const scopes = this.config.scopes || [
      'https://graph.microsoft.com/.default',
      'offline_access',
    ]

    const tokenResponse = await this.credential.getToken(scopes)
    
    if (!tokenResponse) {
      throw new Error('Failed to acquire token')
    }

    // Cache the token
    this.tokenCache.save({
      accessToken: tokenResponse.token,
      expiresOn: tokenResponse.expiresOnTimestamp,
    })

    return tokenResponse.token
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
