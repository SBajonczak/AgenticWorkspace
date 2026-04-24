import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

/**
 * Creates a connected McpClient backed by an in-process McpServer.
 * No network hop — tools are called directly in the same Node.js process.
 *
 * Usage:
 *   const server = createMcpServer(deps)
 *   const client = await createInProcessMcpClient(server)
 *   // pass client to agents
 */
export async function createInProcessMcpClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  const client = new Client(
    { name: 'agentic-workspace-client', version: '1.0.0' },
    { capabilities: {} }
  )

  await server.connect(serverTransport)
  await client.connect(clientTransport)

  return client
}

/**
 * Convenience wrapper: calls a tool and returns the first text content block as a parsed object.
 * Throws if the tool result contains no text content.
 */
export async function callTool<T = unknown>(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const result = await client.callTool({ name, arguments: args })
  const contentArray = result.content as Array<{ type: string; text?: string }>
  const textBlock = contentArray?.find((c) => c.type === 'text')

  if (!textBlock || textBlock.text === undefined) {
    throw new Error(`Tool "${name}" returned no text content`)
  }

  return JSON.parse(textBlock.text) as T
}
