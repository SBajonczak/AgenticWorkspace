import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type StatusRow = {
  id: string
  projectName: string
  meeting: {
    tenantId: string | null
  }
}

function normalizeProjectName(value: string): string {
  return value.trim().toLowerCase()
}

async function main() {
  console.log('🔄 Backfilling Project records from ProjectStatus rows...')

  const statuses = (await prisma.projectStatus.findMany({
    where: { projectId: null },
    select: {
      id: true,
      projectName: true,
      meeting: {
        select: {
          tenantId: true,
        },
      },
    },
  })) as StatusRow[]

  if (statuses.length === 0) {
    console.log('✅ No unmapped ProjectStatus rows found. Nothing to backfill.')
    return
  }

  const grouped = new Map<string, { tenantId: string | null; projectName: string; statusIds: string[] }>()

  for (const row of statuses) {
    const projectName = row.projectName.trim()
    if (!projectName) continue

    const normalizedName = normalizeProjectName(projectName)
    const tenantKey = row.meeting.tenantId ?? '__no_tenant__'
    const key = `${tenantKey}::${normalizedName}`

    const existing = grouped.get(key)
    if (existing) {
      existing.statusIds.push(row.id)
      continue
    }

    grouped.set(key, {
      tenantId: row.meeting.tenantId,
      projectName,
      statusIds: [row.id],
    })
  }

  let createdProjects = 0
  let linkedStatuses = 0

  for (const group of grouped.values()) {
    const tenantProjects = await prisma.project.findMany({
      where: {
        tenantId: group.tenantId,
      },
      select: {
        id: true,
        name: true,
      },
    })

    const existingProject = tenantProjects.find(
      (project) => normalizeProjectName(project.name) === normalizeProjectName(group.projectName)
    )

    const project =
      existingProject ??
      (await prisma.project.create({
        data: {
          tenantId: group.tenantId,
          name: group.projectName,
          status: 'active',
          archived: false,
        },
        select: {
          id: true,
        },
      }))

    if (!existingProject) {
      createdProjects += 1
    }

    const updateResult = await prisma.projectStatus.updateMany({
      where: {
        id: {
          in: group.statusIds,
        },
        projectId: null,
      },
      data: {
        projectId: project.id,
      },
    })

    linkedStatuses += updateResult.count
  }

  console.log(`✅ Backfill completed. Created ${createdProjects} project(s), linked ${linkedStatuses} status row(s).`)
}

main()
  .catch((error) => {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
