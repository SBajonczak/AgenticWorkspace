import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/authz'
import { ProjectRepository } from '@/db/repositories/projectRepository'
import { ProjectMemberRepository } from '@/db/repositories/projectMemberRepository'
import { prisma } from '@/db/prisma'

const projectRepo = new ProjectRepository()
const memberRepo = new ProjectMemberRepository()

const AddMemberSchema = z.object({
  userId: z.string().min(1),
})

const RemoveMemberSchema = z.object({
  memberOid: z.string().min(1),
  memberTid: z.string().min(1),
})

function getTenantId(session: any): string | undefined {
  return (session?.user as any)?.tenantId ?? undefined
}

function getIdentity(session: any): { oid?: string; tid?: string } {
  const user = (session?.user as any) ?? {}
  return {
    oid: user.aadObjectId ?? undefined,
    tid: user.azureTid ?? undefined,
  }
}

async function resolveProjectForAccess(projectId: string, tenantId: string | undefined, identity: { oid?: string; tid?: string }) {
  const project = await projectRepo.findById(projectId)
  if (!project) return null

  if (tenantId) {
    if (project.tenantId && project.tenantId !== tenantId) return null
  } else if (project.tenantId) {
    return null
  }

  const hasAccess = await projectRepo.canUserAccessProject(project.id, identity.tid, identity.oid)
  if (!hasAccess) return null

  return project
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = getTenantId(session)
  const identity = getIdentity(session)

  const project = await resolveProjectForAccess(params.id, tenantId, identity)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canManage = await projectRepo.isProjectOwner(project.id, identity.tid, identity.oid)

  const members = await memberRepo.listByProject(project.id)
  return NextResponse.json({
    canManage,
    owner: {
      oid: project.ownerOid,
      tid: project.ownerTid,
      name: project.ownerName ?? project.owner,
    },
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      oid: member.memberOid,
      tid: member.memberTid,
      displayName: member.displayName ?? member.user.name ?? member.user.email ?? member.memberOid,
      email: member.email ?? member.user.email,
      role: member.role,
    })),
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = getTenantId(session)
  const identity = getIdentity(session)

  const project = await resolveProjectForAccess(params.id, tenantId, identity)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = await projectRepo.isProjectOwner(project.id, identity.tid, identity.oid)
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden: only owner can manage team members' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AddMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      tenantId: tenantId ?? null,
      aadObjectId: { not: null },
    },
    select: {
      id: true,
      aadObjectId: true,
      name: true,
      email: true,
      tenant: {
        select: {
          azureTenantId: true,
        },
      },
    },
  })

  if (!targetUser?.aadObjectId || !targetUser.tenant?.azureTenantId) {
    return NextResponse.json({ error: 'Selected user is not assignable yet' }, { status: 422 })
  }

  if (project.ownerOid === targetUser.aadObjectId && project.ownerTid === targetUser.tenant.azureTenantId) {
    return NextResponse.json({ error: 'Owner already has project access' }, { status: 400 })
  }

  const member = await memberRepo.addMember({
    projectId: project.id,
    userId: targetUser.id,
    memberOid: targetUser.aadObjectId,
    memberTid: targetUser.tenant.azureTenantId,
    displayName: targetUser.name ?? targetUser.email,
    email: targetUser.email,
    role: 'viewer',
  })

  return NextResponse.json({
    member: {
      id: member.id,
      userId: member.userId,
      oid: member.memberOid,
      tid: member.memberTid,
      displayName: member.displayName ?? member.user.name ?? member.user.email ?? member.memberOid,
      email: member.email ?? member.user.email,
      role: member.role,
    },
  }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const tenantId = getTenantId(session)
  const identity = getIdentity(session)

  const project = await resolveProjectForAccess(params.id, tenantId, identity)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = await projectRepo.isProjectOwner(project.id, identity.tid, identity.oid)
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden: only owner can manage team members' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RemoveMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  await memberRepo.removeMember(project.id, parsed.data.memberTid, parsed.data.memberOid)
  return NextResponse.json({ ok: true })
}
