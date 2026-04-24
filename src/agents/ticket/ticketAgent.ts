import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'
import type { Agent, TicketOutput } from '../types'
import { callTool } from '@/mcp/client'

export interface TicketAgentInput {
  meetingDbId: string
  meetingTitle: string
  savedTodoIds: string[]
  ticketProviderType: string
}

interface CheckTicketResult {
  exists: boolean
  ticketKey: string | null
}

interface CreateTicketResult {
  success: boolean
  ticketKey?: string
  ticketUrl?: string
  error?: string
}

interface SavedTodo {
  id: string
  title: string
  description: string
  priority: string
  assigneeHint: string | null
  dueDate: string | null
}

export class TicketAgent implements Agent<TicketAgentInput, TicketOutput> {
  readonly name = 'TicketAgent'

  // No LLM client needed — this agent only uses tool calls
  async run(context: TicketAgentInput, client: McpClient): Promise<TicketOutput> {
    if (context.ticketProviderType === 'none') {
      console.log(`[${this.name}] Ticket provider is 'none' — skipping`)
      return { ticketsSynced: 0, ticketsFailed: 0 }
    }

    // Fetch persisted todos for this meeting (with their DB IDs and project assignments)
    const todos = await callTool<SavedTodo[]>(client, 'list_recent_todos', {
      meetingDbId: context.meetingDbId,
    })

    // Filter to only the todos that were saved in this processing cycle
    const savedIdSet = new Set(context.savedTodoIds)
    const relevantTodos = todos.filter((t) => savedIdSet.has(t.id))

    let ticketsSynced = 0
    let ticketsFailed = 0

    for (const todo of relevantTodos) {
      // Check for existing ticket (idempotency)
      const existing = await callTool<CheckTicketResult>(client, 'check_ticket_exists', {
        todoId: todo.id,
      })

      if (existing.exists) {
        console.log(`[${this.name}] Ticket already exists for "${todo.title}" (${existing.ticketKey}) — skipping`)
        ticketsSynced++
        continue
      }

      // Create ticket — errors are caught and recorded per-todo (no throw)
      const result = await callTool<CreateTicketResult>(client, 'create_ticket', {
        todoId: todo.id,
        title: todo.title,
        description: todo.description,
        priority: todo.priority,
        assigneeHint: todo.assigneeHint,
        dueDate: todo.dueDate,
        meetingTitle: context.meetingTitle,
      })

      if (result.success) {
        console.log(`[${this.name}] Created ticket ${result.ticketKey} for "${todo.title}"`)
        ticketsSynced++
      } else {
        console.error(`[${this.name}] Failed to create ticket for "${todo.title}": ${result.error}`)
        ticketsFailed++
      }
    }

    console.log(`[${this.name}] Ticket sync: ${ticketsSynced} synced, ${ticketsFailed} failed`)
    return { ticketsSynced, ticketsFailed }
  }
}
