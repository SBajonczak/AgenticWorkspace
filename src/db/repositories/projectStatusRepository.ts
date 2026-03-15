import { prisma } from '../prisma'
import { ProjectStatus } from '@prisma/client'

export interface ProjectStatusCreateData {
  meetingId: string
  projectId?: string | null
  projectName: string
  status: string
  summary: string
}

export class ProjectStatusRepository {
  private buildTenantScope(tenantId?: string | null) {
    if (tenantId) {
      return {
        OR: [
          { meeting: { tenantId } },
          { meeting: { tenantId: null }, project: { tenantId: null } },
          { project: { tenantId } },
          { project: { tenantId: null }, meeting: { tenantId: null } },
        ],
      }
    }

    return {
      OR: [
        { meeting: { tenantId: null } },
        { project: { tenantId: null } },
      ],
    }
  }

  async createMany(statuses: ProjectStatusCreateData[]): Promise<number> {
    const result = await prisma.projectStatus.createMany({
      data: statuses,
    })
    return result.count
  }

  async findByMeetingId(meetingId: string, tenantId?: string | null): Promise<ProjectStatus[]> {
    return prisma.projectStatus.findMany({
      where: {
        meetingId,
        ...this.buildTenantScope(tenantId),
      },
      orderBy: { projectName: 'asc' },
    })
  }

  async findAll(): Promise<ProjectStatus[]> {
    return prisma.projectStatus.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        meeting: {
          select: { title: true, startTime: true },
        },
      },
    })
  }

  async findLatestPerProject(tenantId?: string | null): Promise<ProjectStatus[]> {
    // Get the most recent status for each project
    const allStatuses = await prisma.projectStatus.findMany({
      where: this.buildTenantScope(tenantId),
      orderBy: { createdAt: 'desc' },
      include: {
        meeting: {
          select: { title: true, startTime: true },
        },
      },
    })

    // Deduplicate: keep only the latest per project name
    const seen = new Set<string>()
    return allStatuses.filter((s) => {
      const key = s.projectId ?? s.projectName.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  async deleteByMeetingId(meetingId: string): Promise<void> {
    await prisma.projectStatus.deleteMany({ where: { meetingId } })
  }
}
