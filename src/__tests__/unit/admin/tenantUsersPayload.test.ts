import { normalizeTenantUsersPayload } from '@/lib/tenantUsersPayload'

describe('normalizeTenantUsersPayload', () => {
  it('returns users when API responds with object shape { users: [...] }', () => {
    const input = {
      users: [
        {
          userId: 'u1',
          oid: 'oid-1',
          tid: 'tid-1',
          displayName: 'Alice Example',
          email: 'alice@example.com',
          source: 'local',
          canAssign: true,
        },
      ],
    }

    const result = normalizeTenantUsersPayload(input)

    expect(result).toHaveLength(1)
    expect(result[0].oid).toBe('oid-1')
    expect(result[0].displayName).toBe('Alice Example')
  })

  it('returns users when API responds with plain array shape', () => {
    const input = [
      {
        userId: null,
        oid: 'oid-2',
        tid: 'tid-1',
        displayName: 'Bob Graph',
        email: 'bob@example.com',
        source: 'graph',
        canAssign: false,
      },
    ]

    const result = normalizeTenantUsersPayload(input)

    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('graph')
  })

  it('returns empty array for invalid payload shapes', () => {
    expect(normalizeTenantUsersPayload({})).toEqual([])
    expect(normalizeTenantUsersPayload({ users: null })).toEqual([])
    expect(normalizeTenantUsersPayload(null)).toEqual([])
    expect(normalizeTenantUsersPayload(undefined)).toEqual([])
    expect(normalizeTenantUsersPayload('invalid')).toEqual([])
  })
})
