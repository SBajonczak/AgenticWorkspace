import 'next-auth'

declare module 'next-auth' {
  interface Session {
    msGraphConsentRequired?: boolean
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      tenantId?: string
      aadObjectId?: string
      azureTid?: string
      appRoles?: string[]
    }
  }
}
