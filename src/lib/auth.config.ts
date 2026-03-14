import type { NextAuthConfig } from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'

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
    jwt({ token, account }) {
      // Persist the MS Graph access token on first sign-in so the API route
      // can forward it to Microsoft Graph on behalf of the user.
      if (account?.access_token) {
        token.msGraphAccessToken = account.access_token
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
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
} satisfies NextAuthConfig
