import OpenAI from 'openai'
import { z } from 'zod'
import { readFileSync } from 'fs'
import { join } from 'path'

// Response schema for enhanced agent output
export const AgentResponseSchema = z.object({
  meetingSummary: z.object({
    summary: z.string(),
    decisions: z.array(z.string()),
  }),
  projectStatuses: z.array(
    z.object({
      projectName: z.string(),
      status: z.enum(['on_track', 'at_risk', 'blocked', 'completed', 'in_progress']),
      summary: z.string(),
    })
  ).default([]),
  todos: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      assigneeHint: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      priority: z.enum(['high', 'medium', 'low']).default('medium'),
      dueDate: z.string().nullable().default(null),
    })
  ),
  meetingMinutes: z.record(z.string(), z.string()).default({}),
})

export type AgentResponse = z.infer<typeof AgentResponseSchema>

const MeetingPreparationSchema = z.object({
  agenda: z
    .array(
      z.object({
        title: z.string(),
        rationale: z.string(),
        priority: z.enum(['high', 'medium', 'low']).default('medium'),
        source: z.enum(['history', 'knowledge_base', 'conflict']).default('history'),
      })
    )
    .max(10)
    .default([]),
})

export type MeetingPreparationItem = z.infer<typeof MeetingPreparationSchema>['agenda'][number]

export interface LLMConfig {
  apiKey: string
  model?: string
  // Azure OpenAI specific
  azureEndpoint?: string
  azureDeployment?: string
  // Output languages for meeting minutes
  outputLanguages?: string[]
}

export class LLMClient {
  private client: OpenAI
  private model: string
  private systemPrompt: string
  private meetingPreparationPrompt: string
  private outputLanguages: string[]

  constructor(config: LLMConfig) {
    if (config.azureEndpoint && config.azureDeployment) {
      // Azure OpenAI
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: `${config.azureEndpoint}/openai/deployments/${config.azureDeployment}`,
        defaultQuery: { 'api-version': '2024-02-15-preview' },
        defaultHeaders: { 'api-key': config.apiKey },
      })
      this.model = config.azureDeployment
    } else {
      // Standard OpenAI
      this.client = new OpenAI({
        apiKey: config.apiKey,
      })
      this.model = config.model || 'gpt-4o-mini'
    }

    this.outputLanguages = config.outputLanguages || ['de', 'en']

    // Load enhanced system prompt from file
    const promptPath = join(process.cwd(), 'src/ai/prompts/enhanced-meeting-analysis.md')
    this.systemPrompt = readFileSync(promptPath, 'utf-8')

    const preparationPromptPath = join(process.cwd(), 'src/ai/prompts/meeting-preparation.md')
    this.meetingPreparationPrompt = readFileSync(preparationPromptPath, 'utf-8')
  }

  async processTranscript(
    meetingMetadata: {
      title: string
      organizer: string
      startTime: Date
      endTime: Date
    },
    transcript: string
  ): Promise<AgentResponse> {
    const userPrompt = this.buildUserPrompt(meetingMetadata, transcript)

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from LLM')
    }

    // Parse and validate JSON
    const jsonResponse = JSON.parse(responseText)
    const validatedResponse = AgentResponseSchema.parse(jsonResponse)

    return validatedResponse
  }

  async prepareMeetingAgenda(
    upcomingMeeting: {
      title: string
      organizer: string
      startTime: Date
      endTime: Date
    },
    context: {
      relatedMeetings: {
        id: string
        title: string
        startTime: string
        summary: string | null
        decisions: string[]
        openTodos: {
          id: string
          title: string
          assigneeHint: string | null
          status: string
        }[]
        projectStatuses: {
          projectName: string
          status: string
          summary: string
        }[]
      }[]
      conflicts: {
        id: string
        title: string
        startTime: string
        endTime: string
      }[]
    }
  ): Promise<MeetingPreparationItem[]> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.meetingPreparationPrompt,
        },
        {
          role: 'user',
          content: JSON.stringify(
            {
              upcomingMeeting: {
                ...upcomingMeeting,
                startTime: upcomingMeeting.startTime.toISOString(),
                endTime: upcomingMeeting.endTime.toISOString(),
              },
              context,
            },
            null,
            2
          ),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from LLM while preparing agenda')
    }

    const validated = MeetingPreparationSchema.parse(JSON.parse(responseText))
    return validated.agenda
  }

  private buildUserPrompt(
    metadata: {
      title: string
      organizer: string
      startTime: Date
      endTime: Date
    },
    transcript: string
  ): string {
    const languageList = this.outputLanguages.join(', ')
    const languageNote = this.outputLanguages
      .map((lang) => `"${lang}": "<minutes in ${lang}>"`)
      .join(', ')

    return `# Meeting Metadata

Title: ${metadata.title}
Organizer: ${metadata.organizer}
Start Time: ${metadata.startTime.toISOString()}
End Time: ${metadata.endTime.toISOString()}
Duration: ${Math.round((metadata.endTime.getTime() - metadata.startTime.getTime()) / 1000 / 60)} minutes

**Output Languages for meetingMinutes:** ${languageList}
The meetingMinutes field MUST contain keys for ALL of these languages: { ${languageNote} }

# Meeting Transcript

${transcript}

---

Analyze this meeting and return a single JSON object with fields: meetingSummary, projectStatuses, todos, meetingMinutes.
The meetingMinutes object must have an entry for each language listed above.`
  }
}

export function createLLMClient(): LLMClient {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY
  const outputLanguages = (process.env.OUTPUT_LANGUAGES || 'de,en')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)
  const modelOverride = process.env.OPENAI_MODEL

  if (azureEndpoint && azureDeployment && azureApiKey) {
    return new LLMClient({
      apiKey: azureApiKey,
      azureEndpoint,
      azureDeployment,
      outputLanguages,
    })
  } else if (openaiApiKey) {
    return new LLMClient({
      apiKey: openaiApiKey,
      model: modelOverride || 'gpt-4o-mini',
      outputLanguages,
    })
  } else {
    throw new Error(
      'Missing LLM configuration. Set either OPENAI_API_KEY or Azure OpenAI environment variables.'
    )
  }
}
