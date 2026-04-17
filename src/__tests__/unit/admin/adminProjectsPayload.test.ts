import { normalizeAdminProjectsPayload } from '@/lib/adminProjectsPayload'

describe('normalizeAdminProjectsPayload', () => {
  it('returns projects when API responds with object shape { projects: [...] }', () => {
    const input = {
      projects: [
        {
          id: 'p1',
          name: 'Project One',
          description: null,
          status: 'active',
          owner: null,
          ownerOid: null,
          ownerTid: null,
          ownerName: null,
          archived: false,
        },
      ],
    }

    const result = normalizeAdminProjectsPayload(input)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
    expect(result[0].name).toBe('Project One')
  })

  it('returns projects when API responds with a plain array', () => {
    const input = [
      {
        id: 'p2',
        name: 'Project Two',
        description: null,
        status: 'active',
        owner: null,
        ownerOid: null,
        ownerTid: null,
        ownerName: null,
        archived: false,
      },
    ]

    const result = normalizeAdminProjectsPayload(input)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p2')
  })

  it('returns empty array for invalid payload shapes', () => {
    expect(normalizeAdminProjectsPayload({})).toEqual([])
    expect(normalizeAdminProjectsPayload({ projects: null })).toEqual([])
    expect(normalizeAdminProjectsPayload(null)).toEqual([])
    expect(normalizeAdminProjectsPayload(undefined)).toEqual([])
    expect(normalizeAdminProjectsPayload('invalid')).toEqual([])
  })
})
