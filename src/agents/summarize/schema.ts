import { z } from 'zod'

export const SummarizationResponseSchema = z.object({
  summary: z.string(),
  decisions: z.array(z.string()).default([]),
  minutes: z.record(z.string(), z.string()).default({}),
})

export type SummarizationResponse = z.infer<typeof SummarizationResponseSchema>
