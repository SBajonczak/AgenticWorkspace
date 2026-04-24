import { NextResponse } from 'next/server'
import { requireProjectAdmin } from '@/lib/authz'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { UserSyncStateRepository } from '@/db/repositories/userSyncStateRepository'
import { UserTokenService } from '@/graph/userTokenService'
import { MeetingsClient } from '@/graph/meetings'
import { TranscriptsClient } from '@/graph/transcripts'
import { prisma } from '@/db/prisma'

const meetingRepo = new MeetingRepository()

function getTenantId(session: { user: { tenantId?: string } }): string | undefined {
  return session.user.tenantId ?? undefined
}

/** GET /api/admin/worker/meetings — return indexed meetings with audit info for the tenant */
export async function GET(request: Request) {
  const { session, error } = await requireProjectAdmin()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated with this account.' }, { status: 409 })
  }

  const url = new URL(request.url)
  const userFilter = url.searchParams.get('userId') ?? undefined
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const limitParam = url.searchParams.get('limit')

  const fromDate = from ? new Date(from) : undefined
  const toDate = to ? new Date(to) : undefined
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 500) : 200
  const includeGraph = url.searchParams.get('includeGraph') === '1'
  const graphLimitParam = url.searchParams.get('graphLimit')
  const graphLimit = graphLimitParam ? Math.min(Math.max(1, parseInt(graphLimitParam, 10)), 100) : 50
  const withTranscriptProbe = url.searchParams.get('withTranscriptProbe') !== '0'

  if (fromDate && isNaN(fromDate.getTime())) {
    return NextResponse.json({ error: 'Invalid from date.' }, { status: 422 })
  }
  if (toDate && isNaN(toDate.getTime())) {
    return NextResponse.json({ error: 'Invalid to date.' }, { status: 422 })
  }

  let resolvedUserId = userFilter
  if (resolvedUserId && resolvedUserId.includes('@')) {
    const byEmail = await prisma.user.findFirst({
      where: { tenantId, email: resolvedUserId.toLowerCase() },
      select: { id: true },
    })
    resolvedUserId = byEmail?.id
  }

  const meetings = await meetingRepo.listIndexedMeetingsForAdmin({
    tenantId,
    userId: resolvedUserId,
    from: fromDate,
    to: toDate,
    limit,
  })

  const importedRows = meetings.map((meeting) => ({
    id: meeting.id,
    meetingId: meeting.meetingId,
    source: 'imported' as const,
    title: meeting.title,
    startTime: meeting.startTime.toISOString(),
    endTime: meeting.endTime.toISOString(),
    organizer: meeting.organizer,
    organizerEmail: meeting.organizerEmail,
    participants: meeting.participants,
    indexedAt: meeting.indexedAt ? meeting.indexedAt.toISOString() : null,
    indexedForUserId: meeting.indexedForUserId,
    indexedForUserEmail: meeting.indexedForUserEmail,
    indexedByUserId: meeting.indexedByUserId,
    indexedByUserEmail: meeting.indexedByUserEmail,
    processedAt: meeting.processedAt ? meeting.processedAt.toISOString() : null,
    recrawlCount: meeting.recrawlCount,
    lastRecrawlAt: meeting.lastRecrawlAt ? meeting.lastRecrawlAt.toISOString() : null,
    hasTranscript: Boolean(meeting.transcript),
    hasAnalysis: Boolean(meeting.processedAt),
    isIndexing: meeting.isIndexing,
    indexingStartedAt: meeting.indexingStartedAt ? meeting.indexingStartedAt.toISOString() : null,
    graphLastModifiedAt: meeting.graphLastModifiedAt ? meeting.graphLastModifiedAt.toISOString() : null,
  }))

  if (!includeGraph || !resolvedUserId) {
    return NextResponse.json({
      meetings: importedRows,
      meta: {
        includeGraph: false,
        graphLoaded: false,
        graphReason: includeGraph && !resolvedUserId ? 'userId_required' : null,
      },
    })
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: resolvedUserId,
      tenantId,
      accounts: { some: { provider: 'microsoft-entra-id' } },
    },
    select: {
      id: true,
      email: true,
      syncState: { select: { meetingLookaheadDays: true } },
    },
  })

  if (!targetUser) {
    return NextResponse.json({
      meetings: importedRows,
      meta: {
        includeGraph: true,
        graphLoaded: false,
        graphReason: 'user_not_found_or_no_microsoft_account',
      },
    })
  }

  const syncRepo = new UserSyncStateRepository()
  const tokenService = new UserTokenService(syncRepo)
  const accessToken = await tokenService.getValidAccessTokenForUser(targetUser.id)

  const meetingsClient = new MeetingsClient(accessToken)
  const transcriptsClient = new TranscriptsClient(accessToken, targetUser.id, tokenService)

  const now = new Date()
  const toFallback = new Date(now.getTime() + (targetUser.syncState?.meetingLookaheadDays ?? 14) * 24 * 60 * 60 * 1000)
  const effectiveTo = toDate ?? toFallback
  const dayMs = 24 * 60 * 60 * 1000
  const daysForward = Math.max(1, Math.ceil((effectiveTo.getTime() - now.getTime()) / dayMs))
  const daysBack = fromDate ? Math.max(1, Math.ceil((now.getTime() - fromDate.getTime()) / dayMs)) : 30

  const graphMeetings = await meetingsClient.getRecentMeetings(graphLimit, {
    ...(fromDate ? { startAfter: fromDate } : {}),
    daysBack,
    daysForward,
    overlapHours: 0,
  })

  const importedByCompositeKey = new Map(
    importedRows.map((row) => [`${row.meetingId}|${row.startTime}`, row])
  )

  const sortedGraphMeetings = graphMeetings
    .filter((meeting) => {
      const start = new Date(meeting.start.dateTime)
      if (fromDate && start < fromDate) return false
      if (toDate && start > toDate) return false
      return true
    })
    .sort((a, b) => new Date(b.start.dateTime).getTime() - new Date(a.start.dateTime).getTime())

  const graphRows = await Promise.all(
    sortedGraphMeetings.map(async (meeting) => {
      const startIso = new Date(meeting.start.dateTime).toISOString()
      const imported = importedByCompositeKey.get(`${meeting.id}|${startIso}`)
      const hasTranscript = imported
        ? imported.hasTranscript
        : withTranscriptProbe
          ? await transcriptsClient.hasTranscript(meeting.id)
          : false

      return {
        id: imported?.id ?? `graph:${meeting.id}:${startIso}`,
        meetingId: meeting.id,
        source: imported ? ('imported+graph' as const) : ('graph' as const),
        title: meeting.subject,
        startTime: startIso,
        endTime: new Date(meeting.end.dateTime).toISOString(),
        organizer: meeting.organizer?.emailAddress?.name ?? targetUser.email ?? 'Unknown',
        organizerEmail: meeting.organizer?.emailAddress?.address?.toLowerCase() ?? null,
        participants: JSON.stringify(meeting.participants ?? []),
        indexedAt: imported?.indexedAt ?? null,
        indexedForUserId: imported?.indexedForUserId ?? targetUser.id,
        indexedForUserEmail: imported?.indexedForUserEmail ?? targetUser.email,
        indexedByUserId: imported?.indexedByUserId ?? null,
        indexedByUserEmail: imported?.indexedByUserEmail ?? null,
        processedAt: imported?.processedAt ?? null,
        recrawlCount: imported?.recrawlCount ?? 0,
        lastRecrawlAt: imported?.lastRecrawlAt ?? null,
        hasTranscript,
        hasAnalysis: imported?.hasAnalysis ?? false,
        isIndexing: imported?.isIndexing ?? false,
        indexingStartedAt: imported?.indexingStartedAt ?? null,
        graphLastModifiedAt: meeting.lastModifiedDateTime ?? imported?.graphLastModifiedAt ?? null,
      }
    })
  )

  const combinedByKey = new Map<string, (typeof graphRows)[number]>()
  for (const row of importedRows) {
    combinedByKey.set(`${row.meetingId}|${row.startTime}`, row)
  }
  for (const row of graphRows) {
    combinedByKey.set(`${row.meetingId}|${row.startTime}`, row)
  }

  const combinedRows = [...combinedByKey.values()].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )

  return NextResponse.json({
    meetings: combinedRows,
    meta: {
      includeGraph: true,
      graphLoaded: true,
      graphCount: graphRows.length,
      importedCount: importedRows.length,
    },
  })
}
