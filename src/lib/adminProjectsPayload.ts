export interface AdminProjectPayloadItem {
  id: string
  name: string
  description: string | null
  status: string
  owner: string | null
  ownerOid: string | null
  ownerTid: string | null
  ownerName: string | null
  archived: boolean
  _count?: { members: number }
}

export function normalizeAdminProjectsPayload(payload: unknown): AdminProjectPayloadItem[] {
  if (Array.isArray(payload)) {
    return payload as AdminProjectPayloadItem[]
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { projects?: unknown }).projects)
  ) {
    return (payload as { projects: AdminProjectPayloadItem[] }).projects
  }

  return []
}
