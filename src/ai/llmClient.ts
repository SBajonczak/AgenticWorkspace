import OpenAI from 'openai'
import { z } from 'zod'
import { readFileSync } from 'fs'
import { join } from 'path'

// Response schema for agent output
export const AgentResponseSchema = z.object({
  meetingSummary: z.object({
    summary: z.string(),
    decisions: z.array(z.string()),
  }),
  todos: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      assigneeHint: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    })
  ),
})

export type AgentResponse = z.infer<typeof AgentResponseSchema>

export interface LLMConfig {
  apiKey: string
  model?: string
  // Azure OpenAI specific
  azureEndpoint?: string
  azureDeployment?: string
}

export class LLMClient {
  private client: OpenAI
  private model: string
  private systemPrompt: string

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
      this.model = config.model || 'gpt-4-turbo-preview'
    }

    // Load system prompt from file
    const promptPath = join(process.cwd(), 'src/ai/prompts/agent-system.md')
    this.systemPrompt = readFileSync(promptPath, 'utf-8')
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

  private buildUserPrompt(
    metadata: {
      title: string
      organizer: string
      startTime: Date
      endTime: Date
    },
    transcript: string
  ): string {
    return `# Meeting Metadata

Title: ${metadata.title}
Organizer: ${metadata.organizer}
Start Time: ${metadata.startTime.toISOString()}
End Time: ${metadata.endTime.toISOString()}
Duration: ${Math.round((metadata.endTime.getTime() - metadata.startTime.getTime()) / 1000 / 60)} minutes

# Meeting Transcript

${transcript}

---

Process this meeting according to your instructions and return the result as valid JSON.`
  }
}

export function createLLMClient(): LLMClient {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (azureEndpoint && azureDeployment && azureApiKey) {
    return new LLMClient({
      apiKey: azureApiKey,
      azureEndpoint,
      azureDeployment,
    })
  } else if (openaiApiKey) {
    return new LLMClient({
      apiKey: openaiApiKey,
      model: 'gpt-4-turbo-preview',
    })
  } else {
    throw new Error(
      'Missing LLM configuration. Set either OPENAI_API_KEY or Azure OpenAI environment variables.'
    )
  }
}
