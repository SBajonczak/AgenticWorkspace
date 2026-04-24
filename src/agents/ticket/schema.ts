export interface TicketSyncRecord {
  todoId: string
  success: boolean
  ticketKey?: string | null
  error?: string | null
}
