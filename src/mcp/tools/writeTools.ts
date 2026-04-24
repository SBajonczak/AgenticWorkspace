import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { TodoRepository } from '@/db/repositories/todoRepository'
import { MeetingMinutesRepository } from '@/db/repositories/meetingMinutesRepository'
import { ProjectStatusRepository } from '@/db/repositories/projectStatusRepository'
import { ProjectRepository } from '@/db/repositories/projectRepository'

export function registerWriteTools(
  server: McpServer,
  deps: {
    meetingRepo: MeetingRepository
    todoRepo: TodoRepository
    minutesRepo: MeetingMinutesRepository
    projectStatusRepo: ProjectStatusRepository
    projectRepo: ProjectRepository
  }
) {
  // ─── save_summary ───────────────────────────────────────────────────────────
  server.tool(
    'save_summary',
    'Persists the meeting summary and decisions to the DB.',
    {
      meetingDbId: z.string(),
      summary: z.string(),
      decisions: z.array(z.string()),
    },
    async ({ meetingDbId, summary, decisions }) => {
      await deps.meetingRepo.update(meetingDbId, {
        summary,
        decisions: JSON.stringify(decisions),
        processedAt: new Date(),
      })
      return { content: [{ type: 'text' as const, text: 'ok' }] }
    }
  )

  // ─── save_minutes ───────────────────────────────────────────────────────────
  server.tool(
    'save_minutes',
    'Persists meeting minutes per language. Deletes existing minutes for the meeting first.',
    {
      meetingDbId: z.string(),
      minutes: z.record(z.string(), z.string()),
    },
    async ({ meetingDbId, minutes }) => {
      await deps.minutesRepo.deleteByMeetingId(meetingDbId)
      for (const [language, content] of Object.entries(minutes)) {
        await deps.minutesRepo.upsert(meetingDbId, language, content)
      }
      return { content: [{ type: 'text' as const, text: String(Object.keys(minutes).length) }] }
    }
  )

  // ─── save_todos ─────────────────────────────────────────────────────────────
  server.tool(
    'save_todos',
    'Replaces all todos for a meeting. Returns the IDs of the created todos as JSON array.',
    {
      meetingDbId: z.string(),
      todos: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          assigneeHint: z.string().nullable(),
          confidence: z.number(),
          priority: z.enum(['high', 'medium', 'low']),
          dueDate: z.string().nullable(),
        })
      ),
    },
    async ({ meetingDbId, todos }) => {
      await deps.todoRepo.deleteByMeetingId(meetingDbId)
      const data = todos.map((t) => ({
        meetingId: meetingDbId,
        projectId: null as string | null,
        title: t.title,
        description: t.description,
        assigneeHint: t.assigneeHint,
        confidence: t.confidence,
        priority: t.priority,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
      }))
      await deps.todoRepo.createMany(data)
      // Fetch back to get IDs
      const saved = await deps.todoRepo.findByMeetingId(meetingDbId)
      const ids = saved.map((t) => t.id)
      return { content: [{ type: 'text' as const, text: JSON.stringify(ids) }] }
    }
  )

  // ─── save_project_statuses ──────────────────────────────────────────────────
  server.tool(
    'save_project_statuses',
    'Replaces project statuses for a meeting. Accepts pre-resolved projectId (nullable).',
    {
      meetingDbId: z.string(),
      statuses: z.array(
        z.object({
          projectName: z.string(),
          projectId: z.string().nullable(),
          status: z.enum(['on_track', 'at_risk', 'blocked', 'completed', 'in_progress']),
          summary: z.string(),
        })
      ),
    },
    async ({ meetingDbId, statuses }) => {
      await deps.projectStatusRepo.deleteByMeetingId(meetingDbId)
      const count = await deps.projectStatusRepo.createMany(
        statuses.map((s) => ({
          meetingId: meetingDbId,
          projectId: s.projectId,
          projectName: s.projectName,
          status: s.status,
          summary: s.summary,
        }))
      )
      return { content: [{ type: 'text' as const, text: String(count) }] }
    }
  )

  // ─── assign_todo_project ────────────────────────────────────────────────────
  server.tool(
    'assign_todo_project',
    'Links a todo to a project by setting its projectId.',
    {
      todoId: z.string(),
      projectId: z.string().nullable(),
    },
    async ({ todoId, projectId }) => {
      await deps.todoRepo.assignProject(todoId, projectId)
      return { content: [{ type: 'text' as const, text: 'ok' }] }
    }
  )

  // ─── find_or_create_project ─────────────────────────────────────────────────
  server.tool(
    'find_or_create_project',
    'Fuzzy-finds or creates a project by name within the tenant. Returns {id, name}.',
    {
      name: z.string(),
      tenantId: z.string().optional(),
      description: z.string().optional(),
      ownerOid: z.string().optional(),
      ownerTid: z.string().optional(),
      ownerName: z.string().optional(),
    },
    async ({ name, tenantId, description, ownerOid, ownerTid, ownerName }) => {
      const project = await deps.projectRepo.findOrCreateByNameOrAlias(
        name,
        tenantId ?? null,
        {
          description: description ?? null,
          confirmed: false,
          owner:
            ownerOid && ownerTid
              ? { oid: ownerOid, tid: ownerTid, name: ownerName ?? null }
              : undefined,
        }
      )
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id: project.id, name: project.name }) }],
      }
    }
  )
}
