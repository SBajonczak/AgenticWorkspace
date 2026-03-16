import { PrismaClient, TicketSync, Todo } from '@prisma/client'

const prisma = new PrismaClient()

type TodoWithRelations = Todo & {
  ticketSync: TicketSync | null
}

interface CliOptions {
  apply: boolean
  tenantId?: string
  meetingId?: string
}

function parseArgs(argv: string[]): CliOptions {
  const apply = argv.includes('--apply')

  const tenantArg = argv.find((arg) => arg.startsWith('--tenant='))
  const meetingArg = argv.find((arg) => arg.startsWith('--meeting='))

  const tenantId = tenantArg?.split('=')[1]?.trim() || undefined
  const meetingId = meetingArg?.split('=')[1]?.trim() || undefined

  return { apply, tenantId, meetingId }
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeDueDate(value: Date | null): string {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function buildDedupeKey(todo: TodoWithRelations): string {
  return [
    todo.meetingId,
    normalizeText(todo.title),
    normalizeText(todo.description),
    normalizeText(todo.assigneeHint),
    normalizeText(todo.priority),
    normalizeDueDate(todo.dueDate),
  ].join('::')
}

function scoreTodo(todo: TodoWithRelations): number {
  let score = 0

  if (todo.ticketSync?.status === 'synced') score += 1000
  else if (todo.ticketSync?.status === 'pending') score += 300
  else if (todo.ticketSync?.status === 'failed') score += 100

  if (todo.status === 'done') score += 120
  else if (todo.status === 'in_progress') score += 80
  else score += 40

  if (todo.projectId) score += 30
  if (todo.dueDate) score += 20

  score += Math.round(todo.confidence * 100)

  return score
}

function chooseKeeper(todos: TodoWithRelations[]): TodoWithRelations {
  return [...todos].sort((left, right) => {
    const scoreDelta = scoreTodo(right) - scoreTodo(left)
    if (scoreDelta !== 0) return scoreDelta

    const updatedDelta = right.updatedAt.getTime() - left.updatedAt.getTime()
    if (updatedDelta !== 0) return updatedDelta

    return right.createdAt.getTime() - left.createdAt.getTime()
  })[0]
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  console.log('🔎 Todo dedupe starting...')
  console.log(`Mode: ${options.apply ? 'APPLY (deletes duplicates)' : 'DRY-RUN (no changes)'}`)
  if (options.tenantId) console.log(`Tenant filter: ${options.tenantId}`)
  if (options.meetingId) console.log(`Meeting filter: ${options.meetingId}`)

  let scopedMeetingIds: string[] | null = null
  if (options.tenantId) {
    const meetings = await prisma.meeting.findMany({
      where: { tenantId: options.tenantId },
      select: { id: true },
    })
    scopedMeetingIds = meetings.map((meeting) => meeting.id)
    if (scopedMeetingIds.length === 0) {
      console.log('✅ No meetings found for tenant filter. Nothing to do.')
      return
    }
  }

  const todos = (await prisma.todo.findMany({
    where: {
      ...(options.meetingId ? { meetingId: options.meetingId } : {}),
      ...(scopedMeetingIds ? { meetingId: { in: scopedMeetingIds } } : {}),
    },
    include: {
      ticketSync: true,
    },
    orderBy: [{ meetingId: 'asc' }, { createdAt: 'asc' }],
  })) as TodoWithRelations[]

  if (todos.length === 0) {
    console.log('✅ No todos found for the current filter. Nothing to do.')
    return
  }

  const grouped = new Map<string, TodoWithRelations[]>()
  for (const todo of todos) {
    const key = buildDedupeKey(todo)
    const list = grouped.get(key)
    if (list) {
      list.push(todo)
    } else {
      grouped.set(key, [todo])
    }
  }

  const duplicateGroups = [...grouped.values()].filter((group) => group.length > 1)
  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate todo groups detected.')
    return
  }

  let duplicateTodoCount = 0
  let deleteCount = 0
  const deletions: Array<{ id: string; meetingId: string; title: string }> = []

  for (const group of duplicateGroups) {
    duplicateTodoCount += group.length

    const keeper = chooseKeeper(group)
    const toDelete = group.filter((todo) => todo.id !== keeper.id)
    deleteCount += toDelete.length

    for (const todo of toDelete) {
      deletions.push({ id: todo.id, meetingId: todo.meetingId, title: todo.title })
    }

    if (options.apply && toDelete.length > 0) {
      await prisma.todo.deleteMany({
        where: {
          id: { in: toDelete.map((todo) => todo.id) },
        },
      })
    }
  }

  console.log(`📊 Duplicate groups: ${duplicateGroups.length}`)
  console.log(`📊 Todos in duplicate groups: ${duplicateTodoCount}`)
  console.log(`📊 Duplicate todo rows to delete: ${deleteCount}`)

  const preview = deletions.slice(0, 20)
  if (preview.length > 0) {
    console.log('📝 Preview (max 20 deletions):')
    for (const entry of preview) {
      console.log(` - ${entry.id} | meeting=${entry.meetingId} | title="${entry.title}"`)
    }
  }

  if (options.apply) {
    console.log(`✅ Dedupe finished. Deleted ${deleteCount} duplicate todo row(s).`)
  } else {
    console.log('ℹ️ Dry-run only. Re-run with --apply to perform deletion.')
  }
}

main()
  .catch((error) => {
    console.error('❌ Todo dedupe failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
