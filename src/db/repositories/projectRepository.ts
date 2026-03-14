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
}

export interface ProjectUpdateData {
  name?: string
  description?: string | null
  status?: string
  owner?: string | null
  archived?: boolean
}

export class ProjectRepository {
  async create(data: ProjectCreateData): Promise<ProjectWithRelations> {
    return prisma.project.create({
      data: {
        tenantId: data.tenantId ?? null,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? 'active',
        owner: data.owner ?? null,
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

  async findByTenant(tenantId: string, includeArchived = false): Promise<ProjectWithRelations[]> {
    return prisma.project.findMany({
      where: {
        tenantId,
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
    const normalised = nameOrAlias.trim().toLowerCase()

    // Fetch tenant-scoped candidates and do robust case-insensitive exact
    // matching in JS for SQLite compatibility.
    const candidates = await prisma.project.findMany({
      where: {
        archived: false,
        ...(tenantId ? { tenantId } : {}),
      },
      include: { aliases: true, sourceLinks: true },
      orderBy: { name: 'asc' },
    })

    return (
      candidates.find((p) => {
        if (p.name.trim().toLowerCase() === normalised) return true
        return p.aliases.some((a) => a.alias.trim().toLowerCase() === normalised)
      }) ?? null
    )
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
