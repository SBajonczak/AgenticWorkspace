import { PrismaClient } from '@prisma/client'
import { parseDecisionItems, serializeDecisionItems } from '../src/lib/meetingDecisions'

const prisma = new PrismaClient()

interface CliOptions {
  apply: boolean
  tenantId?: string
  meetingId?: string
  limit?: number
}

function parseArgs(argv: string[]): CliOptions {
  const apply = argv.includes('--apply')

  const tenantArg = argv.find((arg) => arg.startsWith('--tenant='))
  const meetingArg = argv.find((arg) => arg.startsWith('--meeting='))
  const limitArg = argv.find((arg) => arg.startsWith('--limit='))

  const tenantId = tenantArg?.split('=')[1]?.trim() || undefined
  const meetingId = meetingArg?.split('=')[1]?.trim() || undefined
  const limitValue = limitArg?.split('=')[1]?.trim()
  const limit = limitValue && Number.isFinite(Number(limitValue)) ? Number(limitValue) : undefined

  return { apply, tenantId, meetingId, limit }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  console.log('Decision dedupe backfill starting...')
  console.log(`Mode: ${options.apply ? 'APPLY (writes changes)' : 'DRY-RUN (no writes)'}`)
  if (options.tenantId) console.log(`Tenant filter: ${options.tenantId}`)
  if (options.meetingId) console.log(`Meeting filter: ${options.meetingId}`)
  if (typeof options.limit === 'number' && options.limit > 0) console.log(`Limit: ${options.limit}`)

  const meetings = await prisma.meeting.findMany({
    where: {
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      ...(options.meetingId ? { id: options.meetingId } : {}),
      decisions: { not: null },
    },
    select: {
      id: true,
      tenantId: true,
      decisions: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    ...(typeof options.limit === 'number' && options.limit > 0 ? { take: options.limit } : {}),
  })

  if (meetings.length === 0) {
    console.log('No meetings matched filters. Nothing to do.')
    return
  }

  let totalMeetingsChanged = 0
  let totalBeforeCount = 0
  let totalAfterCount = 0

  const preview: Array<{ id: string; before: number; after: number }> = []

  for (const meeting of meetings) {
    const decisionsBefore = parseDecisionItems(meeting.decisions)
    const serializedAfter = serializeDecisionItems(decisionsBefore)
    const decisionsAfter = parseDecisionItems(serializedAfter)

    totalBeforeCount += decisionsBefore.length
    totalAfterCount += decisionsAfter.length

    const hasChanged = (meeting.decisions ?? '[]') !== serializedAfter
    if (!hasChanged) continue

    totalMeetingsChanged += 1
    if (preview.length < 25) {
      preview.push({
        id: meeting.id,
        before: decisionsBefore.length,
        after: decisionsAfter.length,
      })
    }

    if (options.apply) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          decisions: serializedAfter,
        },
      })
    }
  }

  console.log(`Meetings scanned: ${meetings.length}`)
  console.log(`Meetings changed: ${totalMeetingsChanged}`)
  console.log(`Decision entries before normalization: ${totalBeforeCount}`)
  console.log(`Decision entries after normalization: ${totalAfterCount}`)

  if (preview.length > 0) {
    console.log('Preview of changed meetings (max 25):')
    for (const item of preview) {
      console.log(` - ${item.id} | decisions: ${item.before} -> ${item.after}`)
    }
  }

  if (options.apply) {
    console.log('Decision dedupe backfill finished.')
  } else {
    console.log('Dry-run complete. Re-run with --apply to persist changes.')
  }
}

main()
  .catch((error) => {
    console.error('Decision dedupe backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
