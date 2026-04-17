import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

export type ProjectMemberWithUser = Prisma.ProjectMemberGetPayload<{
  include: { user: true }
}>

export interface ProjectMemberCreateData {
  projectId: string
  userId: string
  memberOid: string
  memberTid: string
  displayName?: string | null
  email?: string | null
  role?: string
}

export class ProjectMemberRepository {
  async listByProject(projectId: string): Promise<ProjectMemberWithUser[]> {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
    })
  }

  async addMember(data: ProjectMemberCreateData): Promise<ProjectMemberWithUser> {
    return prisma.projectMember.upsert({
      where: {
        projectId_memberTid_memberOid: {
          projectId: data.projectId,
          memberTid: data.memberTid,
          memberOid: data.memberOid,
        },
      },
      create: {
        projectId: data.projectId,
        userId: data.userId,
        memberOid: data.memberOid,
        memberTid: data.memberTid,
        displayName: data.displayName ?? null,
        email: data.email ?? null,
        role: data.role ?? 'viewer',
      },
      update: {
        userId: data.userId,
        displayName: data.displayName ?? null,
        email: data.email ?? null,
        role: data.role ?? 'viewer',
      },
      include: { user: true },
    })
  }

  async removeMember(projectId: string, memberTid: string, memberOid: string): Promise<void> {
    await prisma.projectMember.deleteMany({
      where: {
        projectId,
        memberTid,
        memberOid,
      },
    })
  }
}
