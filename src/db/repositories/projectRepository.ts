import { prisma } from '../prisma'
import { Project, ProjectAlias, Prisma } from '@prisma/client'

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: { aliases: true; sourceLinks: true }
}>

export interface ProjectCreateData {
  tenantId?: string | null
  name: string
  description?: string | null
  status?: string
  owner?: string | null
  confirmed?: boolean
}

export interface ProjectUpdateData {
  name?: string
  description?: string | null
  status?: string
  owner?: string | null
  archived?: boolean
  confirmed?: boolean
}

export class ProjectRepository {
  private buildTenantScope(tenantId?: string | null): Prisma.ProjectWhereInput {
    if (tenantId) {
      return {
        OR: [{ tenantId }, { tenantId: null }],
      }
    }

    return { tenantId: null }
  }

  private normalizeName(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private tokenizeName(value: string): string[] {
    return this.normalizeName(value)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  }

  private scoreCandidate(nameOrAlias: string, candidateValues: string[]): number {
    const normalizedQuery = this.normalizeName(nameOrAlias)
    if (!normalizedQuery) return 0

    const queryTokens = this.tokenizeName(nameOrAlias)

    let bestScore = 0
    for (const rawCandidate of candidateValues) {
      const normalizedCandidate = this.normalizeName(rawCandidate)
      if (!normalizedCandidate) continue

      if (normalizedCandidate === normalizedQuery) return 100

      if (
        normalizedCandidate.length >= 6 &&
        normalizedQuery.length >= 6 &&
        (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate))
      ) {
        bestScore = Math.max(bestScore, 80)
      }

      const candidateTokens = this.tokenizeName(rawCandidate)
      if (queryTokens.length === 0 || candidateTokens.length === 0) continue

      const overlap = queryTokens.filter((token) => candidateTokens.includes(token)).length
      if (overlap === 0) continue

      if (overlap === queryTokens.length || overlap === candidateTokens.length) {
        bestScore = Math.max(bestScore, 70)
        continue
      }

      const overlapRatio = overlap / Math.max(queryTokens.length, candidateTokens.length)
      if (overlapRatio >= 0.6) {
        bestScore = Math.max(bestScore, 60)
      }
    }

    return bestScore
  }

  async create(data: ProjectCreateData): Promise<ProjectWithRelations> {
    return prisma.project.create({
      data: {
        tenantId: data.tenantId ?? null,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? 'active',
        owner: data.owner ?? null,
        confirmed: data.confirmed ?? true,
      },
      include: { aliases: true, sourceLinks: true },
    })
  }

  async findById(id: string): Promise<ProjectWithRelations | null> {
    return prisma.project.findUnique({
      where: { id },
      include: { aliases: true, sourceLinks: true },
    })
  }

  async findByTenant(tenantId?: string | null, includeArchived = false): Promise<ProjectWithRelations[]> {
    return prisma.project.findMany({
      where: {
        ...this.buildTenantScope(tenantId),
        ...(includeArchived ? {} : { archived: false }),
      },
      orderBy: { name: 'asc' },
      include: { aliases: true, sourceLinks: true },
    })
  }

  async update(id: string, data: ProjectUpdateData): Promise<ProjectWithRelations> {
    return prisma.project.update({
      where: { id },
      data,
      include: { aliases: true, sourceLinks: true },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } })
  }

  /**
   * Find a project whose name or any alias matches the given string
   * (case-insensitive exact match). Returns the first match ordered by name.
   */
  async findByNameOrAlias(
    nameOrAlias: string,
    tenantId?: string | null
  ): Promise<ProjectWithRelations | null> {
    const candidates = await prisma.project.findMany({
      where: {
        archived: false,
        confirmed: true,
        ...this.buildTenantScope(tenantId),
      },
      include: { aliases: true, sourceLinks: true },
      orderBy: { name: 'asc' },
    })

    let bestMatch: ProjectWithRelations | null = null
    let bestScore = 0

    for (const candidate of candidates) {
      const score = this.scoreCandidate(nameOrAlias, [
        candidate.name,
        ...candidate.aliases.map((alias) => alias.alias),
      ])

      if (score > bestScore) {
        bestScore = score
        bestMatch = candidate
      }
    }

    return bestScore >= 60 ? bestMatch : null
  }

  // ---------------------------------------------------------------------------
  // Alias management
  // ---------------------------------------------------------------------------

  async addAlias(projectId: string, alias: string): Promise<ProjectAlias> {
    return prisma.projectAlias.upsert({
      where: { projectId_alias: { projectId, alias } },
      create: { projectId, alias },
      update: {},
    })
  }

  async removeAlias(projectId: string, alias: string): Promise<void> {
    await prisma.projectAlias.deleteMany({ where: { projectId, alias } })
  }

  async setAliases(projectId: string, aliases: string[]): Promise<ProjectAlias[]> {
    await prisma.projectAlias.deleteMany({ where: { projectId } })
    if (aliases.length === 0) return []
    return Promise.all(
      aliases.map((alias) => prisma.projectAlias.create({ data: { projectId, alias } }))
    )
  }
}
