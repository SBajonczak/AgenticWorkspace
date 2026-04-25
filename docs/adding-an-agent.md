# Neuen Agenten zur MCP-Pipeline hinzufügen

Diese Anleitung beschreibt Schritt für Schritt, wie ein neuer Agent zur bestehenden Multi-Agent-Pipeline hinzugefügt wird — von der Implementierung bis zur Steuerung der Ausführungsreihenfolge.

---

## Überblick: Was ist ein Agent?

Ein Agent ist eine TypeScript-Klasse, die:
1. Ein **typdefiniertes Input**-Objekt empfängt
2. Optional einen oder mehrere **LLM-Calls** macht
3. Ergebnisse über **MCP-Tool-Calls** in die Datenbank schreibt
4. Ein **typdefiniertes Output**-Objekt zurückgibt

```typescript
export interface Agent<TInput, TOutput> {
  readonly name: string
  run(input: TInput, client: McpClient): Promise<TOutput>
}
```

Der `McpClient` ist die einzige Verbindung zur Außenwelt (DB, externe APIs). Direkte Datenbankzugriffe oder HTTP-Calls außerhalb des MCP-Servers sind zu vermeiden — das garantiert Testbarkeit und saubere Abhängigkeiten.

---

## Schritt-für-Schritt Anleitung

### Schritt 1 — Ordnerstruktur anlegen

Erstelle einen neuen Unterordner unter `src/agents/`:

```
src/agents/
└── meinagent/
    ├── meinAgent.ts     # Implementierung
    └── schema.ts        # Zod-Schema für LLM-Output
```

**Namenskonvention:** Verzeichnis in kebab-case, Klasse in PascalCase mit Suffix `Agent`.

---

### Schritt 2 — Output-Schema definieren (`schema.ts`)

Definiere mit Zod, was der LLM zurückgeben soll. Das Schema dient gleichzeitig als Typdefinition und als Laufzeit-Validierung.

```typescript
// src/agents/meinagent/schema.ts
import { z } from 'zod'

export const MeinAgentResponseSchema = z.object({
  // Beispiel: Sentimentanalyse
  overallSentiment: z.enum(['positive', 'neutral', 'negative']),
  topicsDetected: z.array(z.string()).default([]),
  riskScore: z.number().min(0).max(1).default(0),
})

export type MeinAgentResponse = z.infer<typeof MeinAgentResponseSchema>
```

---

### Schritt 3 — Output-Typ in `types.ts` registrieren

Füge das Ergebnis-Interface des Agenten in `src/agents/types.ts` hinzu:

```typescript
// src/agents/types.ts

// Neuen Output-Typ hinzufügen:
export interface MeinAgentOutput {
  overallSentiment: 'positive' | 'neutral' | 'negative'
  topicsDetected: string[]
  riskScore: number
  tokensUsed: number
}

// Das AgentPipelineResult um das neue Feld erweitern:
export interface AgentPipelineResult {
  meetingDbId: string
  durationMs: number
  totalTokensUsed: number
  summarization: AgentResult<SummarizationOutput>
  keyPoints: AgentResult<KeyPointsOutput>
  projectMatching: AgentResult<ProjectMatchOutput>
  tickets: AgentResult<TicketOutput>
  meinAgent: AgentResult<MeinAgentOutput>  // ← NEU
}
```

---

### Schritt 4 — System Prompt schreiben (`src/ai/prompts/`)

Erstelle eine Markdown-Datei mit dem System Prompt für deinen Agenten:

```markdown
<!-- src/ai/prompts/agent-mein-agent.md -->
# Mein Agent

Du bist ein Spezialist für [Aufgabe]. Deine einzige Aufgabe ist es, [genau beschreiben].

## Regeln
- [Regel 1]
- [Regel 2]
- Gib NUR valides JSON zurück

## Output Schema
{
  "overallSentiment": "positive | neutral | negative",
  "topicsDetected": ["string"],
  "riskScore": 0.0
}
```

**Best Practices für Prompts:**
- Einen Agenten eng fokussieren — je schmaler die Aufgabe, desto besser die Qualität
- Explizit sagen was der Agent NICHT tun soll (Abgrenzung zu anderen Agenten)
- Das JSON-Schema direkt im Prompt zeigen

---

### Schritt 5 — Agenten implementieren (`meinAgent.ts`)

```typescript
// src/agents/meinagent/meinAgent.ts
import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js'
import type { Agent, MeetingContext, MeinAgentOutput } from '../types'
import { MeinAgentResponseSchema } from './schema'
import { callTool } from '@/mcp/client'

export class MeinAgent implements Agent<MeetingContext, MeinAgentOutput> {
  readonly name = 'MeinAgent'

  private systemPrompt: string

  constructor(private openai: OpenAI, private model: string) {
    const promptPath = join(process.cwd(), 'src/ai/prompts/agent-mein-agent.md')
    this.systemPrompt = readFileSync(promptPath, 'utf-8')
  }

  async run(context: MeetingContext, client: McpClient): Promise<MeinAgentOutput> {
    const userPrompt = `# Meeting: ${context.title}
# Transcript
${context.transcript}
---
Analysiere und gib JSON zurück.`

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const tokensUsed = completion.usage?.total_tokens ?? 0
    const responseText = completion.choices[0]?.message?.content
    if (!responseText) throw new Error(`[${this.name}] Keine Antwort vom LLM`)

    const parsed = MeinAgentResponseSchema.parse(JSON.parse(responseText))

    // Optional: Ergebnis über MCP-Tool in die DB schreiben
    // await callTool(client, 'mein_custom_tool', { meetingDbId: context.meetingDbId, ... })

    console.log(`[${this.name}] Sentiment: ${parsed.overallSentiment}, RiskScore: ${parsed.riskScore}`)

    return {
      overallSentiment: parsed.overallSentiment,
      topicsDetected: parsed.topicsDetected,
      riskScore: parsed.riskScore,
      tokensUsed,
    }
  }
}
```

**Hinweis:** Kein LLM nötig? Dann lass `openai` und `model` weg und implementiere den Agenten als reine Tool-Call-Schleife (wie `TicketAgent`).

---

### Schritt 6 — (Optional) Neues MCP-Tool hinzufügen

Falls der Agent Daten persistieren muss, die kein bestehendes Tool abdeckt:

**6a. Prisma-Migration prüfen** — Braucht das neue Ergebnis eine neue DB-Tabelle? Falls ja: Prisma-Schema anpassen und migrieren.

**6b. Tool in der passenden Tool-Datei registrieren:**

```typescript
// src/mcp/tools/writeTools.ts  (oder eine neue Datei für eigene Tools)

server.tool(
  'save_sentiment',
  'Speichert die Sentiment-Analyse eines Meetings.',
  {
    meetingDbId: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    riskScore: z.number(),
  },
  async ({ meetingDbId, sentiment, riskScore }) => {
    // await deps.meetingRepo.update(meetingDbId, { sentiment, riskScore })
    return { content: [{ type: 'text' as const, text: 'ok' }] }
  }
)
```

**6c. Das neue Tool im Agenten aufrufen:**

```typescript
await callTool(client, 'save_sentiment', {
  meetingDbId: context.meetingDbId,
  sentiment: parsed.overallSentiment,
  riskScore: parsed.riskScore,
})
```

---

### Schritt 7 — Agenten in den Orchestrator einbauen

Öffne `src/agents/orchestrator.ts` und füge den neuen Agenten hinzu.

#### 7a. Import hinzufügen

```typescript
import { MeinAgent } from './meinagent/meinAgent'
```

#### 7b. Als Instanz-Variable im Konstruktor anlegen

```typescript
private meinAgent: MeinAgent

constructor(private mcpServer: McpServer, private config: OrchestratorConfig) {
  const { openai, model } = config
  this.summarizationAgent = new SummarizationAgent(openai, model)
  this.keyPointsAgent = new KeyPointsAgent(openai, model)
  this.projectMatchingAgent = new ProjectMatchingAgent(openai, model)
  this.ticketAgent = new TicketAgent()
  this.meinAgent = new MeinAgent(openai, model)  // ← NEU
}
```

#### 7c. In der richtigen Phase hinzufügen

Entscheide zuerst: **Phase 1 oder Phase 2?**

| Phase | Wann verwenden |
|---|---|
| **Phase 1** | Agent benötigt nur das Transkript + Meeting-Metadaten |
| **Phase 2** | Agent benötigt Todos (aus KeyPoints) oder Summary (aus Summarization) |

**Beispiel: Agent braucht nur das Transkript → Phase 1:**

```typescript
// Phase 1: Parallel
const [summarizationSettled, keyPointsSettled, meinAgentSettled] =
  await Promise.allSettled([
    this.summarizationAgent.run(context, client),
    this.keyPointsAgent.run(context, client),
    this.meinAgent.run(context, client),    // ← NEU in Phase 1
  ])

const meinAgent: AgentResult<MeinAgentOutput> = wrapSettledResult(meinAgentSettled)
```

**Beispiel: Agent braucht Todos → Phase 2:**

```typescript
// Phase 2: Parallel
const [projectMatchingSettled, ticketsSettled, meinAgentSettled] =
  await Promise.allSettled([
    this.projectMatchingAgent.run({ ...context, todos: keyPointsValue?.todos ?? [] }, client),
    this.ticketAgent.run({ ... }, client),
    this.meinAgent.run({               // ← NEU in Phase 2
      ...context,
      todos: keyPointsValue?.todos ?? [],
    }, client),
  ])

const meinAgent: AgentResult<MeinAgentOutput> = wrapSettledResult(meinAgentSettled)
```

#### 7d. Ergebnis in `AgentPipelineResult` aufnehmen

```typescript
return {
  meetingDbId: context.meetingDbId,
  durationMs,
  totalTokensUsed,
  summarization,
  keyPoints,
  projectMatching,
  tickets,
  meinAgent,      // ← NEU
}
```

#### 7e. Token-Summe anpassen

```typescript
const totalTokensUsed =
  (summarization.status === 'fulfilled' ? summarization.value.tokensUsed : 0) +
  (keyPoints.status === 'fulfilled' ? keyPoints.value.tokensUsed : 0) +
  (projectMatching.status === 'fulfilled' ? projectMatching.value.tokensUsed : 0) +
  (meinAgent.status === 'fulfilled' ? meinAgent.value.tokensUsed : 0) // ← NEU
```

---

## Ausführungsreihenfolge steuern

### Drei Ausführungsmodi

#### Modus 1: Parallel (Standard, empfohlen)

```typescript
// Alle drei laufen gleichzeitig — schnellste Variante
const [a, b, c] = await Promise.allSettled([
  agentA.run(context, client),
  agentB.run(context, client),
  agentC.run(context, client),
])
```

**Wann:** Der Agent benötigt keine Ausgabe eines anderen Agenten aus derselben Phase.

---

#### Modus 2: Sequenziell (wenn Agent B das Ergebnis von Agent A braucht)

```typescript
// Agent A zuerst
const resultA = await agentA.run(context, client)

// Agent B bekommt A's Ergebnis als Input
const resultB = await agentB.run({ ...context, dataFromA: resultA }, client)
```

**Wann:** Strikte Abhängigkeit — z.B. ein "Review-Agent" der die Summary eines anderen prüft.

---

#### Modus 3: Neue Phase einführen (wenn eine Gruppe abhängig von einer anderen ist)

Das aktuelle Muster mit Phase 1 + Phase 2 ist ein Sonderfall von Sequenziell. Für eine dritte Abhängigkeitsstufe einfach eine Phase 3 einführen:

```typescript
// Phase 1: Unabhängige Agenten
const [summarizationSettled, keyPointsSettled] = await Promise.allSettled([...])

// Phase 2: Abhängig von Phase 1
const [projectMatchingSettled, ticketsSettled] = await Promise.allSettled([...])

// Phase 3: Abhängig von Phase 1 UND Phase 2
const projectMatchValue = projectMatching.status === 'fulfilled' ? projectMatching.value : null
const [reviewAgentSettled] = await Promise.allSettled([
  reviewAgent.run({
    ...context,
    projectStatuses: projectMatchValue?.projectStatusesCreated ?? 0,
    summary: summarization.status === 'fulfilled' ? summarization.value.summary : '',
  }, client),
])
```

**Wann:** Ein Agent braucht Outputs aus verschiedenen vorherigen Phasen.

---

### Entscheidungsbaum: Welche Phase?

```
Mein Agent braucht...
│
├── ...nur das Transkript/Metadaten?
│   └── → Phase 1 (parallel mit Summarization + KeyPoints)
│
├── ...die extrahierten Todos?
│   └── → Phase 2 (parallel mit ProjectMatching + Ticket)
│
├── ...die Projektstatus-Ergebnisse?
│   └── → Phase 3 (neu anlegen, nach Phase 2)
│
└── ...zwingend das Ergebnis von einem einzelnen anderen Agenten?
    └── → Sequenziell nach diesem Agenten (eigene await-Zeile)
```

---

## Checkliste: Neuen Agenten hinzufügen

```
[ ] src/agents/meinagent/schema.ts          — Zod-Schema für LLM-Output
[ ] src/agents/meinagent/meinAgent.ts       — Agent-Implementierung
[ ] src/ai/prompts/agent-mein-agent.md      — System Prompt (falls LLM-basiert)
[ ] src/agents/types.ts                     — MeinAgentOutput + AgentPipelineResult erweitern
[ ] src/mcp/tools/writeTools.ts             — Neues MCP-Tool (falls DB-Schreibzugriff nötig)
[ ] src/agents/orchestrator.ts              — Agent instanziieren + in Phase einbauen
[ ] Token-Summe in orchestrator.ts anpassen
[ ] Manuelle Test: USE_MULTI_AGENT_PIPELINE=true mit einem realen Transkript
```

---

## Agenten ohne LLM-Call

Nicht jeder Agent braucht eine LLM-Anfrage. Der `TicketAgent` ist ein Beispiel für einen reinen Tool-Call-Agenten:

```typescript
export class MeinToolAgent implements Agent<MyInput, MyOutput> {
  readonly name = 'MeinToolAgent'

  // Kein OpenAI-Client nötig
  async run(context: MyInput, client: McpClient): Promise<MyOutput> {
    // Nur Tool-Calls
    const data = await callTool<SomeType>(client, 'some_tool', { ... })
    await callTool(client, 'save_result', { ... })
    return { ... }
  }
}
```

Solche Agenten sind deutlich günstiger (keine Token-Kosten) und deutlich schneller (~10–100ms statt ~2–8s).

---

## Agenten testen

Da jeder Agent einen `McpClient` als Parameter empfängt, lässt er sich isoliert testen — ohne echte Datenbank oder LLM.

```typescript
// Beispiel Unit Test
import { MeinAgent } from '@/agents/meinagent/meinAgent'

const mockClient = {
  callTool: jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(['todo-id-1']) }],
  }),
} as unknown as McpClient

const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          overallSentiment: 'positive',
          topicsDetected: ['Q1 Planning'],
          riskScore: 0.2,
        }) } }],
        usage: { total_tokens: 500 },
      }),
    },
  },
} as unknown as OpenAI

const agent = new MeinAgent(mockOpenAI, 'gpt-4o-mini')
const result = await agent.run(mockContext, mockClient)

expect(result.overallSentiment).toBe('positive')
expect(mockClient.callTool).toHaveBeenCalledWith(...)
```
