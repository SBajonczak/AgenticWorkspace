import type { NextAuthConfig } from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { prisma } from '@/db/prisma'
import { TenantRepository } from '@/db/repositories/tenantRepository'

const requiredGraphScopes = [
  'Calendars.Read',
  'OnlineMeetings.Read',
  'OnlineMeetingTranscript.Read.All',
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
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
      authorization: {
        params: {
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
        },
      },
    }),
  ],
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
      if (typeof token?.msGraphConsentRequired === 'boolean') {
        // @ts-expect-error extended session field
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
