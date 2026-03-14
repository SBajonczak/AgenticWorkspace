/** @jest-environment node */
import { AgentResponseSchema } from '@/ai/llmClient'

const validResponse = {
  meetingSummary: {
    summary: 'We discussed the roadmap and agreed on priorities.',
    decisions: ['Delay feature X by two weeks', 'Hire two more engineers'],
  },
  todos: [
    {
      title: 'Set up CI pipeline',
      description: 'Configure GitHub Actions for automated testing.',
      assigneeHint: 'alice@example.com',
      confidence: 0.92,
      priority: 'high',
      dueDate: '2026-04-01',
    },
  ],
  projectStatuses: [
    {
      projectName: 'Phoenix',
      status: 'on_track',
      summary: 'On schedule; last milestone delivered on time.',
    },
  ],
  meetingMinutes: {
    en: '# Meeting Minutes\n\nDate: ...',
    de: '# Sitzungsprotokoll\n\nDatum: ...',
  },
}

describe('AgentResponseSchema', () => {
  it('parses a valid full response', () => {
    const result = AgentResponseSchema.parse(validResponse)
    expect(result.meetingSummary.summary).toBeTruthy()
    expect(result.todos).toHaveLength(1)
    expect(result.todos[0].priority).toBe('high')
    expect(result.projectStatuses).toHaveLength(1)
    expect(result.meetingMinutes.en).toContain('Meeting Minutes')
  })

  it('applies default priority "medium" when omitted', () => {
    const input = {
      ...validResponse,
      todos: [{ ...validResponse.todos[0], priority: undefined }],
    }
    const result = AgentResponseSchema.parse(input)
    expect(result.todos[0].priority).toBe('medium')
  })

  it('accepts null dueDate', () => {
    const input = {
      ...validResponse,
      todos: [{ ...validResponse.todos[0], dueDate: null }],
    }
    const result = AgentResponseSchema.parse(input)
    expect(result.todos[0].dueDate).toBeNull()
  })

  it('defaults projectStatuses to empty array when omitted', () => {
    const { projectStatuses: _, ...withoutStatuses } = validResponse
    const result = AgentResponseSchema.parse(withoutStatuses)
    expect(result.projectStatuses).toEqual([])
  })

  it('defaults meetingMinutes to empty object when omitted', () => {
    const { meetingMinutes: _, ...withoutMinutes } = validResponse
    const result = AgentResponseSchema.parse(withoutMinutes)
    expect(result.meetingMinutes).toEqual({})
  })

  it('throws on missing meetingSummary', () => {
    const { meetingSummary: _, ...bad } = validResponse
    expect(() => AgentResponseSchema.parse(bad)).toThrow()
  })

  it('throws on invalid priority value', () => {
    const bad = {
      ...validResponse,
      todos: [{ ...validResponse.todos[0], priority: 'critical' }],
    }
    expect(() => AgentResponseSchema.parse(bad)).toThrow()
  })

  it('throws on confidence out of range', () => {
    const bad = {
      ...validResponse,
      todos: [{ ...validResponse.todos[0], confidence: 1.5 }],
    }
    expect(() => AgentResponseSchema.parse(bad)).toThrow()
  })

  it('throws on invalid project status', () => {
    const bad = {
      ...validResponse,
      projectStatuses: [{ ...validResponse.projectStatuses[0], status: 'good' }],
    }
    expect(() => AgentResponseSchema.parse(bad)).toThrow()
  })
})
