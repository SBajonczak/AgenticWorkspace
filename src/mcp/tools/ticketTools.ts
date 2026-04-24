import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { ITicketProvider } from '@/tickets/types'
import { TicketSyncRepository } from '@/db/repositories/ticketSyncRepository'
import { TodoRepository } from '@/db/repositories/todoRepository'

export function registerTicketTools(
  server: McpServer,
  deps: {
    ticketProvider: ITicketProvider
    ticketSyncRepo: TicketSyncRepository
    todoRepo: TodoRepository
  }
) {
  // ─── check_ticket_exists ────────────────────────────────────────────────────
  server.tool(
    'check_ticket_exists',
    'Checks if a ticket sync record already exists for a given todo ID.',
    { todoId: z.string() },
    async ({ todoId }) => {
      const sync = await deps.ticketSyncRepo.findByTodoId(todoId)
      const result =
        sync && sync.status === 'synced'
          ? { exists: true, ticketKey: sync.ticketKey }
          : { exists: false, ticketKey: null }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
    }
  )

  // ─── create_ticket ──────────────────────────────────────────────────────────
  server.tool(
    'create_ticket',
    'Creates a ticket in the configured provider (Jira/GitHub/ADO) for a todo and records the sync.',
    {
      todoId: z.string(),
      title: z.string(),
      description: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      assigneeHint: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      meetingTitle: z.string().optional(),
    },
    async ({ todoId, title, description, priority, assigneeHint, dueDate, meetingTitle }) => {
      try {
        const result = await deps.ticketProvider.createTicket({
          title,
          description,
          assigneeHint,
          priority,
          dueDate: dueDate ? new Date(dueDate) : null,
          meetingTitle,
        })
        await deps.ticketSyncRepo.markSynced(todoId, result)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, ticketKey: result.key, ticketUrl: result.url }),
            },
          ],
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        await deps.ticketSyncRepo.markFailed(todoId, deps.ticketProvider.type, msg)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: msg }) }],
        }
      }
    }
  )

  // ─── find_assignee ──────────────────────────────────────────────────────────
  server.tool(
    'find_assignee',
    'Resolves a free-text name or email to the provider assignee ID. Returns null if not found.',
    { nameOrEmail: z.string() },
    async ({ nameOrEmail }) => {
      try {
        const assigneeId = await deps.ticketProvider.findAssignee(nameOrEmail)
        return { content: [{ type: 'text' as const, text: JSON.stringify({ assigneeId }) }] }
      } catch {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ assigneeId: null }) }] }
      }
    }
  )
}
