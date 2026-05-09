import { z } from 'zod'

export const SummarizationDecisionSchema = z.object({
  topic: z.string(),
  rationale: z.string().default(''),
  quote: z.string().default(''),
  speaker: z.string().nullable().optional().default(null),
  timestamp: z.string().nullable().optional().default(null),
  confidence: z.number().min(0).max(1).nullable().optional().default(null),
})

export const SummarizationResponseSchema = z.object({
  summary: z.string(),
  decisions: z
    .array(
      z.union([
        z.string(),
        SummarizationDecisionSchema,
      ])
    )
    .default([]),
  minutes: z.record(z.string(), z.string()).default({}),
})

export type SummarizationResponse = z.infer<typeof SummarizationResponseSchema>
