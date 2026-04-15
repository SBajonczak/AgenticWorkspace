import { prisma } from '../prisma'
import { ProjectSourceLink } from '@prisma/client'

export type KnowledgeSourceType = 'confluence' | 'jira' | 'github' | 'sharepoint'

export interface SourceLinkCreateData {
  projectId: string
  type: KnowledgeSourceType
  label?: string | null
  identifier: string
  config?: Record<string, unknown> | null
}

export interface SourceLinkUpdateData {
  label?: string | null
  identifier?: string
  config?: Record<string, unknown> | null
}

export class ProjectSourceLinkRepository {
  async create(data: SourceLinkCreateData): Promise<ProjectSourceLink> {
    return prisma.projectSourceLink.create({
      data: {
        projectId: data.projectId,
        type: data.type,
        label: data.label ?? null,
        identifier: data.identifier,
        config: data.config ? JSON.stringify(data.config) : null,
      },
    })
  }

  async findByProject(projectId: string): Promise<ProjectSourceLink[]> {
    return prisma.projectSourceLink.findMany({
      where: { projectId },
      orderBy: [{ type: 'asc' }, { identifier: 'asc' }],
    })
  }

  async findById(id: string): Promise<ProjectSourceLink | null> {
    return prisma.projectSourceLink.findUnique({ where: { id } })
  }

  async update(id: string, data: SourceLinkUpdateData): Promise<ProjectSourceLink> {
    return prisma.projectSourceLink.update({
      where: { id },
      data: {
        label: data.label,
        ...(data.identifier !== undefined ? { identifier: data.identifier } : {}),
        ...(data.config !== undefined
          ? { config: data.config ? JSON.stringify(data.config) : null }
          : {}),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.projectSourceLink.delete({ where: { id } })
  }
}
