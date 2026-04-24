import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'
import type { Agent, MeetingContext, KeyPointsOutput, RawTodo } from '../types'
import { KeyPointsResponseSchema } from './schema'
import { callTool } from '@/mcp/client'

export class KeyPointsAgent implements Agent<MeetingContext, KeyPointsOutput> {
  readonly name = 'KeyPointsAgent'

  private systemPrompt: string

  constructor(private openai: OpenAI, private model: string) {
    const promptPath = join(process.cwd(), 'src/ai/prompts/agent-keypoints.md')
    this.systemPrompt = readFileSync(promptPath, 'utf-8')
  }

  async run(context: MeetingContext, client: McpClient): Promise<KeyPointsOutput> {
    const userPrompt = `# Meeting
Title: ${context.title}
Organizer: ${context.organizer}
Start: ${context.startTime.toISOString()}
Participants: ${context.participants.join(', ') || 'unknown'}

# Transcript
${context.transcript}

---
Extract all action items. Return JSON with field: todos (array).
Only include todos with confidence >= 0.6.`

    console.log(`[${this.name}] Calling LLM for meeting "${context.title}"`)

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

    const parsed = KeyPointsResponseSchema.parse(JSON.parse(responseText))

    // Filter low-confidence todos
    const filteredTodos = parsed.todos.filter((t) => t.confidence >= 0.6)

    console.log(
      `[${this.name}] Extracted ${parsed.todos.length} todos, ${filteredTodos.length} after confidence filter`
    )

    // Persist via MCP — returns array of saved IDs
    const savedIds = await callTool<string[]>(client, 'save_todos', {
      meetingDbId: context.meetingDbId,
      todos: filteredTodos,
    })

    const todos: RawTodo[] = filteredTodos.map((t) => ({
      title: t.title,
      description: t.description,
      assigneeHint: t.assigneeHint,
      confidence: t.confidence,
      priority: t.priority,
      dueDate: t.dueDate,
    }))

    return {
      todos,
      savedTodoIds: savedIds,
      tokensUsed,
    }
  }
}
