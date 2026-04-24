import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'
import type { Agent, MeetingContext, ProjectMatchOutput, RawTodo } from '../types'
import { ProjectMatchingResponseSchema } from './schema'
import { callTool } from '@/mcp/client'

export interface ProjectMatchingInput extends MeetingContext {
  todos: RawTodo[]
  savedTodoIds: string[]
}

interface ProjectEntry {
  id: string
  name: string
  description: string | null
  aliases: string[]
}

export class ProjectMatchingAgent implements Agent<ProjectMatchingInput, ProjectMatchOutput> {
  readonly name = 'ProjectMatchingAgent'

  private systemPrompt: string

  constructor(private openai: OpenAI, private model: string) {
    const promptPath = join(process.cwd(), 'src/ai/prompts/agent-project-matching.md')
    this.systemPrompt = readFileSync(promptPath, 'utf-8')
  }

  async run(context: ProjectMatchingInput, client: McpClient): Promise<ProjectMatchOutput> {
    // Fetch tenant project list via MCP
    const projects = await callTool<ProjectEntry[]>(client, 'list_tenant_projects', {
      tenantId: context.tenantId ?? undefined,
    })

    if (projects.length === 0) {
      console.log(`[${this.name}] No projects found for tenant — skipping`)
      return { projectStatusesCreated: 0, todoProjectMappings: {}, tokensUsed: 0 }
    }

    const projectListText = projects
      .map((p) => {
        const aliasText = p.aliases.length > 0 ? ` (aliases: ${p.aliases.join(', ')})` : ''
        const descText = p.description ? `\n  Description: ${p.description}` : ''
        return `- ID: ${p.id}\n  Name: ${p.name}${aliasText}${descText}`
      })
      .join('\n')

    const todoListText =
      context.todos.length > 0
        ? context.todos
            .map((t, i) => `${i}: [${t.priority}] ${t.title} (assignee: ${t.assigneeHint ?? 'unknown'})`)
            .join('\n')
        : 'No todos extracted.'

    const userPrompt = `# Meeting
Title: ${context.title}
Organizer: ${context.organizer}
Start: ${context.startTime.toISOString()}

# Available Projects
${projectListText}

# Extracted Todos (by index)
${todoListText}

# Transcript
${context.transcript}

---
Which projects are discussed? What is their status?
Map todos to projects by index. Return JSON with: projectStatuses, todoMappings.`

    console.log(
      `[${this.name}] Calling LLM with ${projects.length} projects and ${context.todos.length} todos for "${context.title}"`
    )

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const tokensUsed = completion.usage?.total_tokens ?? 0
    const responseText = completion.choices[0]?.message?.content
    if (!responseText) throw new Error(`[${this.name}] No response from LLM`)

    const parsed = ProjectMatchingResponseSchema.parse(JSON.parse(responseText))

    console.log(
      `[${this.name}] Found ${parsed.projectStatuses.length} relevant projects, ${parsed.todoMappings.length} todo mappings`
    )

    // Persist project statuses
    let projectStatusesCreated = 0
    if (parsed.projectStatuses.length > 0) {
      const count = await callTool<number>(client, 'save_project_statuses', {
        meetingDbId: context.meetingDbId,
        statuses: parsed.projectStatuses.map((ps) => ({
          projectName: ps.projectName,
          projectId: ps.projectId,
          status: ps.status,
          summary: ps.summary,
        })),
      })
      projectStatusesCreated = count
    }

    // Apply todo→project mappings
    const todoProjectMappings: Record<string, string | null> = {}
    for (const mapping of parsed.todoMappings) {
      const todoId = context.savedTodoIds[mapping.todoIndex]
      if (!todoId) continue
      todoProjectMappings[todoId] = mapping.projectId
      if (mapping.projectId) {
        await callTool(client, 'assign_todo_project', {
          todoId,
          projectId: mapping.projectId,
        })
      }
    }

    return { projectStatusesCreated, todoProjectMappings, tokensUsed }
  }
}
