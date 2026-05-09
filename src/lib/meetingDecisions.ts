export interface MeetingDecisionItem {
  topic: string
  rationale: string
  quote: string
  speaker: string | null
  timestamp: string | null
  confidence: number | null
}

type DecisionInput =
  | string
  | {
      topic?: unknown
      decision?: unknown
      text?: unknown
      rationale?: unknown
      reason?: unknown
      argument?: unknown
      quote?: unknown
      citation?: unknown
      speaker?: unknown
      timestamp?: unknown
      confidence?: unknown
    }

function asNonEmptyString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export function normalizeDecisionTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function toDecisionItem(input: DecisionInput): MeetingDecisionItem | null {
  if (typeof input === 'string') {
    const topic = asNonEmptyString(input)
    if (!topic) return null
    return {
      topic,
      rationale: '',
      quote: '',
      speaker: null,
      timestamp: null,
      confidence: null,
    }
  }

  const topic =
    asNonEmptyString(input.topic) ||
    asNonEmptyString(input.decision) ||
    asNonEmptyString(input.text)
  if (!topic) return null

  const confidenceValue = typeof input.confidence === 'number' && Number.isFinite(input.confidence)
    ? Math.max(0, Math.min(1, input.confidence))
    : null

  return {
    topic,
    rationale:
      asNonEmptyString(input.rationale) ||
      asNonEmptyString(input.reason) ||
      asNonEmptyString(input.argument),
    quote: asNonEmptyString(input.quote) || asNonEmptyString(input.citation),
    speaker: asNonEmptyString(input.speaker) || null,
    timestamp: asNonEmptyString(input.timestamp) || null,
    confidence: confidenceValue,
  }
}

function decisionScore(item: MeetingDecisionItem): number {
  let score = 0
  if (item.rationale.length > 0) score += 4
  if (item.quote.length > 0) score += 4
  if (item.speaker) score += 1
  if (item.timestamp) score += 1
  if (typeof item.confidence === 'number') score += 1
  return score
}

export function dedupeDecisionItems(inputs: Array<DecisionInput>): MeetingDecisionItem[] {
  const byTopic = new Map<string, MeetingDecisionItem>()

  for (const input of inputs) {
    const candidate = toDecisionItem(input)
    if (!candidate) continue

    const key = normalizeDecisionTopic(candidate.topic)
    if (!key) continue

    const existing = byTopic.get(key)
    if (!existing || decisionScore(candidate) > decisionScore(existing)) {
      byTopic.set(key, candidate)
    }
  }

  return [...byTopic.values()]
}

export function parseDecisionItems(value: string | null | undefined): MeetingDecisionItem[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return dedupeDecisionItems(parsed as DecisionInput[])
  } catch {
    return []
  }
}

export function serializeDecisionItems(items: Array<DecisionInput>): string {
  return JSON.stringify(dedupeDecisionItems(items))
}

export function getDecisionTopics(items: Array<DecisionInput>): string[] {
  return dedupeDecisionItems(items).map((item) => item.topic)
}
