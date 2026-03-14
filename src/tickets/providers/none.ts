import { ITicketProvider, TicketInput, TicketResult } from '../types'

/**
 * No-op provider used when no ticket system is configured for a tenant.
 * All operations succeed silently without contacting any external system.
 */
export class NoneTicketProvider implements ITicketProvider {
  readonly type = 'none' as const

  async createTicket(_input: TicketInput): Promise<TicketResult> {
    return { id: '', key: '', url: '', provider: 'none' }
  }

  async findAssignee(_nameOrEmail: string): Promise<string | null> {
    return null
  }

  async testConnection(): Promise<boolean> {
    return true
  }
}
