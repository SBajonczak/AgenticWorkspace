import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { MeetingRepository } from '@/db/repositories/meetingRepository'
import { TodoRepository } from '@/db/repositories/todoRepository'
import { MeetingMinutesRepository } from '@/db/repositories/meetingMinutesRepository'
import { ProjectStatusRepository } from '@/db/repositories/projectStatusRepository'
import { ProjectRepository } from '@/db/repositories/projectRepository'
import { TicketSyncRepository } from '@/db/repositories/ticketSyncRepository'
import { ITicketProvider } from '@/tickets/types'
import { NoneTicketProvider } from '@/tickets/providers/none'
import { registerReadTools } from './tools/readTools'
import { registerWriteTools } from './tools/writeTools'
import { registerTicketTools } from './tools/ticketTools'

export interface McpServerDeps {
  meetingRepo: MeetingRepository
  todoRepo: TodoRepository
  minutesRepo: MeetingMinutesRepository
  projectStatusRepo: ProjectStatusRepository
  projectRepo: ProjectRepository
  ticketSyncRepo: TicketSyncRepository
  ticketProvider: ITicketProvider
}

export function createMcpServer(deps: McpServerDeps): McpServer {
  const server = new McpServer({
    name: 'agentic-workspace',
    version: '1.0.0',
  })

  registerReadTools(server, {
    meetingRepo: deps.meetingRepo,
    projectRepo: deps.projectRepo,
    todoRepo: deps.todoRepo,
  })

  registerWriteTools(server, {
    meetingRepo: deps.meetingRepo,
    todoRepo: deps.todoRepo,
    minutesRepo: deps.minutesRepo,
    projectStatusRepo: deps.projectStatusRepo,
    projectRepo: deps.projectRepo,
  })

  registerTicketTools(server, {
    ticketProvider: deps.ticketProvider,
    ticketSyncRepo: deps.ticketSyncRepo,
    todoRepo: deps.todoRepo,
  })

  return server
}

export function createDefaultMcpServerDeps(ticketProvider?: ITicketProvider): McpServerDeps {
  return {
    meetingRepo: new MeetingRepository(),
    todoRepo: new TodoRepository(),
    minutesRepo: new MeetingMinutesRepository(),
    projectStatusRepo: new ProjectStatusRepository(),
    projectRepo: new ProjectRepository(),
    ticketSyncRepo: new TicketSyncRepository(),
    ticketProvider: ticketProvider ?? new NoneTicketProvider(),
  }
}
