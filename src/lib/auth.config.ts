import type { NextAuthConfig } from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { prisma } from '@/db/prisma'
import { TenantRepository } from '@/db/repositories/tenantRepository'

type EnvLookupResult = {
  value?: string
  key?: string
}

function readFirstDefinedEnv(keys: string[]): EnvLookupResult {
  for (const key of keys) {
    const raw = process.env[key]
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (value.length === 0) continue
    return { value, key }
  }
  return {}
}

function isAllowedTenantId(value: string): boolean {
  const aliases = new Set(['common', 'organizations', 'consumers'])
  if (aliases.has(value)) return true

  const tenantGuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return tenantGuid.test(value)
}

const azureClientIdLookup = readFirstDefinedEnv([
  'AZURE_CLIENT_ID',
  'AUTH_MICROSOFT_ENTRA_ID_ID',
])

const azureClientSecretLookup = readFirstDefinedEnv([
  'AZURE_CLIENT_SECRET',
  'AUTH_MICROSOFT_ENTRA_ID_SECRET',
])

const azureTenantIdLookup = readFirstDefinedEnv([
  'AZURE_TENANT_ID',
  'AUTH_MICROSOFT_ENTRA_ID_TENANT_ID',
])

const azureClientId = azureClientIdLookup.value
const azureClientSecret = azureClientSecretLookup.value
const azureTenantId = azureTenantIdLookup.value

const missingEntraEnv: string[] = []
if (!azureClientId) missingEntraEnv.push('AZURE_CLIENT_ID|AUTH_MICROSOFT_ENTRA_ID_ID')
if (!azureClientSecret) missingEntraEnv.push('AZURE_CLIENT_SECRET|AUTH_MICROSOFT_ENTRA_ID_SECRET')
if (!azureTenantId) missingEntraEnv.push('AZURE_TENANT_ID|AUTH_MICROSOFT_ENTRA_ID_TENANT_ID')

const hasValidTenant = typeof azureTenantId === 'string' && isAllowedTenantId(azureTenantId)
if (azureTenantId && !hasValidTenant) {
  console.error(
    `[auth] Invalid AZURE_TENANT_ID format: expected a tenant GUID or one of common|organizations|consumers, got "${azureTenantId}".`
  )
}

const hasValidEntraProviderConfig = missingEntraEnv.length === 0 && hasValidTenant

if (!hasValidEntraProviderConfig) {
  const reasons = [
    ...missingEntraEnv,
    ...(azureTenantId && !hasValidTenant ? ['AZURE_TENANT_ID format invalid'] : []),
  ]
  console.warn(
    `[auth] Microsoft Entra provider disabled due to incomplete configuration: ${reasons.join(', ')}`
  )
}

const azureIssuer = hasValidTenant
  ? `https://login.microsoftonline.com/${azureTenantId}/v2.0`
  : undefined

const requiredGraphScopes = [
  'Calendars.Read',
  'OnlineMeetings.Read',
  'OnlineMeetingTranscript.Read.All',
  'People.Read',
  'offline_access',
]

function hasAllRequiredScopes(scopeString?: string | null): boolean {
  if (!scopeString) return false
  const grantedScopes = new Set(scopeString.split(' ').map((scope) => scope.trim()).filter(Boolean))
  return requiredGraphScopes.every((scope) => grantedScopes.has(scope))
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.')
  if (segments.length < 2) return null

  try {
    return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function extractAzureTenantId(params: {
  account?: { id_token?: string | null } | null
  profile?: Record<string, unknown> | null
  token?: Record<string, unknown> | null
}): string | undefined {
  const profileTenantId =
    getString(params.profile?.tid) ??
    getString(params.profile?.tenantId) ??
    getString(params.profile?.tenant_id)

  if (profileTenantId) return profileTenantId

  const tokenTenantId =
    getString(params.token?.tenantId) ??
    getString(params.token?.azureTenantId) ??
    getString(params.token?.tid)

  if (tokenTenantId) return tokenTenantId

  const idTokenPayload = params.account?.id_token ? decodeJwtPayload(params.account.id_token) : null
  const idTokenTenantId =
    getString(idTokenPayload?.tid) ??
    getString(idTokenPayload?.tenantId) ??
    getString(idTokenPayload?.tenant_id)

  if (idTokenTenantId) return idTokenTenantId

  return process.env.AZURE_TENANT_ID
}

function extractAzureObjectId(params: {
  account?: { id_token?: string | null } | null
  profile?: Record<string, unknown> | null
  token?: Record<string, unknown> | null
}): string | undefined {
  const profileObjectId =
    getString(params.profile?.oid) ??
    getString(params.profile?.objectId)

  if (profileObjectId) return profileObjectId

  const tokenObjectId =
    getString(params.token?.aadObjectId) ??
    getString(params.token?.oid)

  if (tokenObjectId) return tokenObjectId

  const idTokenPayload = params.account?.id_token ? decodeJwtPayload(params.account.id_token) : null
  const idTokenObjectId =
    getString(idTokenPayload?.oid) ??
    getString(idTokenPayload?.objectId)

  if (idTokenObjectId) return idTokenObjectId

  return undefined
}

async function resolveStoredTenantId(params: {
  userId?: string | null
  email?: string | null
}): Promise<string | undefined> {
  if (params.userId) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { tenantId: true },
    })
    if (user?.tenantId) return user.tenantId
  }

  if (params.email) {
    const user = await prisma.user.findUnique({
      where: { email: params.email },
      select: { tenantId: true },
    })
    if (user?.tenantId) return user.tenantId
  }

  return undefined
}

async function ensureUserTenantAssociation(params: {
  userId?: string | null
  email?: string | null
  azureTenantId?: string
  tenantName?: string | null
}): Promise<string | undefined> {
  const existingTenantId = await resolveStoredTenantId(params)
  if (existingTenantId) return existingTenantId

  if (!params.azureTenantId) return undefined

  const tenantRepo = new TenantRepository()
  const tenant = await tenantRepo.findOrCreate(params.azureTenantId, params.tenantName ?? undefined)

  if (params.userId) {
    await prisma.user.update({
      where: { id: params.userId },
      data: { tenantId: tenant.id },
    })
    return tenant.id
  }

  if (params.email) {
    const updated = await prisma.user.updateMany({
      where: { email: params.email },
      data: { tenantId: tenant.id },
    })
    if (updated.count > 0) return tenant.id
  }

  return undefined
}

async function resolvePersistedUserId(params: {
  provider: string
  providerAccountId?: string | null
  email?: string | null
  fallbackUserId?: string | null
}): Promise<string | null> {
  const { provider, providerAccountId, email, fallbackUserId } = params

  if (providerAccountId) {
    const linkedAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      select: {
        userId: true,
      },
    })
    if (linkedAccount?.userId) return linkedAccount.userId
  }

  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existingUser?.id) return existingUser.id
  }

  if (fallbackUserId) {
    const existingUser = await prisma.user.findUnique({
      where: { id: fallbackUserId },
      select: { id: true },
    })
    if (existingUser?.id) return existingUser.id
  }

  return null
}

export const authConfig = {
  providers: hasValidEntraProviderConfig && azureClientId && azureClientSecret && azureIssuer
    ? [
      MicrosoftEntraID({
        clientId: azureClientId,
        clientSecret: azureClientSecret,
        issuer: azureIssuer,
        authorization: {
          params: {
            scope: [
              'openid',
              'profile',
              'email',
              'offline_access',
              'User.Read',
              'People.Read',
              'Calendars.Read',
              'OnlineMeetings.Read',
              'OnlineMeetingTranscript.Read.All',
            ].join(' '),
          },
        },
      }),
    ]
    : [],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'microsoft-entra-id') {
        return true
      }

      try {
        const persistedUserId = await resolvePersistedUserId({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: user?.email,
          fallbackUserId: user?.id,
        })

        if (!persistedUserId) {
          console.warn('[auth] Skipping token-state write: no persisted user found during signIn callback', {
            provider: account.provider,
            hasEmail: Boolean(user?.email),
          })
          return true
        }

        const azureTenantId = extractAzureTenantId({
          account,
          profile: (profile as Record<string, unknown> | undefined) ?? null,
        })
        await ensureUserTenantAssociation({
          userId: persistedUserId,
          email: user?.email,
          azureTenantId,
          tenantName: user?.name,
        })

        const aadObjectId = extractAzureObjectId({
          account,
          profile: (profile as Record<string, unknown> | undefined) ?? null,
        })

        if (aadObjectId) {
          await prisma.user.update({
            where: { id: persistedUserId },
            data: {
              // Use an index signature cast to avoid stale TS diagnostics during schema rollout.
              ['aadObjectId' as string]: aadObjectId,
            } as Record<string, unknown>,
          })
        }

        const existingAccount = await prisma.account.findFirst({
          where: {
            userId: persistedUserId,
            provider: 'microsoft-entra-id',
          },
          select: {
            refresh_token: true,
            scope: true,
          },
        })

        const hasRefreshToken = Boolean(account.refresh_token || existingAccount?.refresh_token)
        const effectiveScope = account.scope ?? existingAccount?.scope
        const consentRequired = !hasRefreshToken || !hasAllRequiredScopes(effectiveScope)
        const syncRepo = new UserSyncStateRepository()
        await syncRepo.setTokenState(persistedUserId, hasRefreshToken, consentRequired)
      } catch (error) {
        console.error('[auth] Non-blocking signIn callback error while updating token state', error)
      }

      return true
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === 'microsoft-entra-id') {
        token.msGraphConsentRequired = !account.refresh_token || !hasAllRequiredScopes(account.scope)

        const aadObjectId = extractAzureObjectId({
          account,
          profile: (profile as Record<string, unknown> | undefined) ?? null,
          token: token as Record<string, unknown>,
        })
        if (aadObjectId) {
          ;(token as Record<string, unknown>).aadObjectId = aadObjectId
        }

        // Extract Azure AD App Roles from the id_token
        if (account.id_token) {
          const idTokenPayload = decodeJwtPayload(account.id_token)
          const roles = idTokenPayload?.roles
          if (Array.isArray(roles) && roles.every((r) => typeof r === 'string')) {
            ;(token as Record<string, unknown>).appRoles = roles
          }
        }
      }

      // Never store large delegated access tokens in the JWT cookie payload.
      delete (token as Record<string, unknown>).msGraphAccessToken

      const azureTenantId = extractAzureTenantId({
        account,
        profile: (profile as Record<string, unknown> | undefined) ?? null,
        token: token as Record<string, unknown>,
      })

      if (azureTenantId) {
        token.azureTenantId = azureTenantId
      }

      // IMPORTANT: jwt callback runs in middleware (Edge runtime), so no Prisma calls here.
      // tenantId is persisted during signIn callback on Node runtime.
      // If the user object (from DB adapter, available on sign-in) has a tenantId, copy it into
      // the token so it survives across sessions without requiring a fresh sign-in.
      if (user && typeof (user as Record<string, unknown>).tenantId === 'string') {
        token.tenantId = (user as Record<string, unknown>).tenantId as string
      }
      if (typeof token.tenantId !== 'string') {
        delete (token as Record<string, unknown>).tenantId
      }

      return token
    },
    async session({ session, user, token }) {
      const userId = user?.id ?? token?.sub
      if (session.user && userId) {
        session.user.id = userId
      }

      // IMPORTANT: session callback also runs in middleware (Edge runtime), so no Prisma calls here.
      const tenantId = getString(token?.tenantId)
      if (session.user && tenantId) {
        ;(session.user as { tenantId?: string }).tenantId = tenantId
      }

      const aadObjectId = getString((token as Record<string, unknown>)?.aadObjectId)
      if (session.user && aadObjectId) {
        ;(session.user as { aadObjectId?: string }).aadObjectId = aadObjectId
      }

      const azureTenantId = getString((token as Record<string, unknown>)?.azureTenantId)
      if (session.user && azureTenantId) {
        ;(session.user as { azureTid?: string }).azureTid = azureTenantId
      }

      const appRoles = (token as Record<string, unknown>)?.appRoles
      if (session.user && Array.isArray(appRoles)) {
        ;(session.user as { appRoles?: string[] }).appRoles = appRoles as string[]
      }

      if (typeof token?.msGraphConsentRequired === 'boolean') {
        session.msGraphConsentRequired = token.msGraphConsentRequired
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
} satisfies NextAuthConfig
