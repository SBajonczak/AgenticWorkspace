import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'
import type { Agent, MeetingContext, SummarizationOutput } from '../types'
import { SummarizationResponseSchema } from './schema'
import { callTool } from '@/mcp/client'

export class SummarizationAgent implements Agent<MeetingContext, SummarizationOutput> {
  readonly name = 'SummarizationAgent'

  private systemPrompt: string

  constructor(private openai: OpenAI, private model: string) {
    const promptPath = join(process.cwd(), 'src/ai/prompts/agent-summarization.md')
    this.systemPrompt = readFileSync(promptPath, 'utf-8')
  }

  async run(context: MeetingContext, client: McpClient): Promise<SummarizationOutput> {
    const languageList = context.outputLanguages.join(', ')
    const languageNote = context.outputLanguages
      .map((lang) => `"${lang}": "<minutes in ${lang}>"`)
      .join(', ')

    const userPrompt = `# Meeting
Title: ${context.title}
Organizer: ${context.organizer}
Start: ${context.startTime.toISOString()}
End: ${context.endTime.toISOString()}
Duration: ${Math.round((context.endTime.getTime() - context.startTime.getTime()) / 60000)} minutes

**Required minute languages:** ${languageList}
The "minutes" object MUST have keys: { ${languageNote} }

# Transcript
${context.transcript}

---
Return JSON with fields: summary, decisions, minutes.`

    console.log(`[${this.name}] Calling LLM for meeting "${context.title}"`)

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const tokensUsed = completion.usage?.total_tokens ?? 0
    const responseText = completion.choices[0]?.message?.content
    if (!responseText) throw new Error(`[${this.name}] No response from LLM`)

    const parsed = SummarizationResponseSchema.parse(JSON.parse(responseText))

    console.log(
      `[${this.name}] Summary: ${parsed.summary.length} chars | Decisions: ${parsed.decisions.length} | Minutes languages: ${Object.keys(parsed.minutes).join(', ')}`
    )

    // Persist via MCP tools
    await callTool(client, 'save_summary', {
      meetingDbId: context.meetingDbId,
      summary: parsed.summary,
      decisions: parsed.decisions,
    })

    await callTool(client, 'save_minutes', {
      meetingDbId: context.meetingDbId,
      minutes: parsed.minutes,
    })

    return {
      summary: parsed.summary,
      decisions: parsed.decisions,
      minutesPerLanguage: parsed.minutes,
      tokensUsed,
    }
  }
}
