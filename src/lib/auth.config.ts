import type { NextAuthConfig } from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { prisma } from '@/db/prisma'

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
    async signIn({ user, account }) {
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
    jwt({ token, account }) {
      // Persist the MS Graph access token on first sign-in so the API route
      // can forward it to Microsoft Graph on behalf of the user.
      if (account?.access_token) {
        token.msGraphAccessToken = account.access_token
      }
      if (account?.provider === 'microsoft-entra-id') {
        token.msGraphConsentRequired = !account.refresh_token || !hasAllRequiredScopes(account.scope)
      }
      return token
    },
    session({ session, user, token }) {
      const userId = user?.id ?? token?.sub
      if (session.user && userId) {
        session.user.id = userId
      }
      if (token?.msGraphAccessToken) {
        // @ts-expect-error extended session field
        session.msGraphAccessToken = token.msGraphAccessToken as string
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
