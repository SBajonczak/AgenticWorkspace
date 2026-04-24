import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { ProjectRepository } from '@/db/repositories/projectRepository'
import { TodoRepository } from '@/db/repositories/todoRepository'

export function registerReadTools(
  server: McpServer,
  deps: {
    meetingRepo: MeetingRepository
    projectRepo: ProjectRepository
    todoRepo: TodoRepository
  }
) {
  // ─── get_meeting_context ────────────────────────────────────────────────────
  server.tool(
    'get_meeting_context',
    'Returns meeting metadata (without transcript) for a given DB meeting ID.',
    { meetingDbId: z.string() },
    async ({ meetingDbId }) => {
      const meeting = await deps.meetingRepo.findById(meetingDbId)
      if (!meeting) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `Meeting ${meetingDbId} not found` }) }] }
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              id: meeting.id,
              meetingId: meeting.meetingId,
              title: meeting.title,
              organizer: meeting.organizer,
              organizerEmail: meeting.organizerEmail,
              startTime: meeting.startTime,
              endTime: meeting.endTime,
              participants: meeting.participants ? JSON.parse(meeting.participants) : [],
              tenantId: meeting.tenantId,
            }),
          },
        ],
      }
    }
  )

  // ─── get_transcript_segment ─────────────────────────────────────────────────
  server.tool(
    'get_transcript_segment',
    'Returns the full transcript for a given DB meeting ID.',
    { meetingDbId: z.string() },
    async ({ meetingDbId }) => {
      const meeting = await deps.meetingRepo.findById(meetingDbId)
      if (!meeting) {
        return { content: [{ type: 'text' as const, text: '' }] }
      }
      return { content: [{ type: 'text' as const, text: meeting.transcript ?? '' }] }
    }
  )

  // ─── list_tenant_projects ───────────────────────────────────────────────────
  server.tool(
    'list_tenant_projects',
    'Returns all non-archived projects for a tenant including aliases.',
    { tenantId: z.string().optional() },
    async ({ tenantId }) => {
      const projects = await deps.projectRepo.findByTenant(tenantId ?? null)
      const mapped = projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        aliases: p.aliases.map((a) => a.alias),
      }))
      return { content: [{ type: 'text' as const, text: JSON.stringify(mapped) }] }
    }
  )

  // ─── get_project_by_name ────────────────────────────────────────────────────
  server.tool(
    'get_project_by_name',
    'Fuzzy-matches a project name or alias against the tenant project list. Returns null if no match.',
    { name: z.string(), tenantId: z.string().optional() },
    async ({ name, tenantId }) => {
      const project = await deps.projectRepo.findByNameOrAlias(name, tenantId ?? null)
      return {
        content: [
          {
            type: 'text' as const,
            text: project
              ? JSON.stringify({ id: project.id, name: project.name })
              : JSON.stringify(null),
          },
        ],
      }
    }
  )

  // ─── list_recent_todos ──────────────────────────────────────────────────────
  server.tool(
    'list_recent_todos',
    'Returns todos for a meeting (used for duplicate detection before ticket creation).',
    { meetingDbId: z.string() },
    async ({ meetingDbId }) => {
      const todos = await deps.todoRepo.findByMeetingId(meetingDbId)
      const mapped = todos.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        assigneeHint: t.assigneeHint,
        priority: t.priority,
        confidence: t.confidence,
        projectId: t.projectId,
        dueDate: t.dueDate,
      }))
      return { content: [{ type: 'text' as const, text: JSON.stringify(mapped) }] }
    }
  )
}
