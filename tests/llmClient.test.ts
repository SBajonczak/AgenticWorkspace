import { AgentResponseSchema } from '../src/ai/llmClient'

describe('AgentResponseSchema', () => {
  it('should validate correct agent response', () => {
    const validResponse = {
      meetingSummary: {
        summary: 'This is a test meeting summary.',
        decisions: ['Decision 1', 'Decision 2'],
      },
      todos: [
        {
          title: 'Complete the report',
          description: 'Finish the Q1 report by Friday',
          assigneeHint: 'John Doe',
          confidence: 0.9,
        },
      ],
    }

    const result = AgentResponseSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
  })

  it('should reject response with missing fields', () => {
    const invalidResponse = {
      meetingSummary: {
        summary: 'Test summary',
      },
      todos: [],
    }

    const result = AgentResponseSchema.safeParse(invalidResponse)
    expect(result.success).toBe(false)
  })

  it('should reject response with invalid confidence', () => {
    const invalidResponse = {
      meetingSummary: {
        summary: 'Test summary',
        decisions: [],
      },
      todos: [
        {
          title: 'Test',
          description: 'Test',
          assigneeHint: null,
          confidence: 1.5, // Invalid: > 1
        },
      ],
    }

    const result = AgentResponseSchema.safeParse(invalidResponse)
    expect(result.success).toBe(false)
  })

  it('should accept null assigneeHint', () => {
    const validResponse = {
      meetingSummary: {
        summary: 'Test summary',
        decisions: ['Decision'],
      },
      todos: [
        {
          title: 'Test',
          description: 'Test description',
          assigneeHint: null,
          confidence: 0.8,
        },
      ],
    }

    const result = AgentResponseSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
  })
})
