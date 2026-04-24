import { z } from 'zod'

export const ProjectMatchingResponseSchema = z.object({
  projectStatuses: z.array(
    z.object({
      projectId: z.string(),
      projectName: z.string(),
      status: z.enum(['on_track', 'at_risk', 'blocked', 'completed', 'in_progress']),
      summary: z.string(),
    })
  ).default([]),
  todoMappings: z.array(
    z.object({
      todoIndex: z.number(),
      projectId: z.string().nullable(),
    })
  ).default([]),
})

export type ProjectMatchingResponse = z.infer<typeof ProjectMatchingResponseSchema>
