import { z } from 'zod'

export const KeyPointsResponseSchema = z.object({
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
})

export type KeyPointsResponse = z.infer<typeof KeyPointsResponseSchema>
