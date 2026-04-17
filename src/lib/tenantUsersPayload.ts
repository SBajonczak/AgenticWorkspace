export interface TenantUserSearchEntry {
  userId: string | null
  oid: string
  tid: string
  displayName: string
  email: string | null
  source: 'local' | 'graph'
  canAssign: boolean
}

export function normalizeTenantUsersPayload(payload: unknown): TenantUserSearchEntry[] {
  if (Array.isArray(payload)) {
    return payload as TenantUserSearchEntry[]
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { users?: unknown }).users)
  ) {
    return (payload as { users: TenantUserSearchEntry[] }).users
  }

  return []
}