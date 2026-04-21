import { prisma } from '../prisma'
import { Tenant, Prisma } from '@prisma/client'
import { TicketProviderConfig } from '@/tickets/types'

interface CheckpointActor {
  userId: string
  email: string
}

export class TenantRepository {
  async findByAzureTenantId(azureTenantId: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({ where: { azureTenantId } })
  }

  async findById(id: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({ where: { id } })
  }

  /**
   * Find an existing tenant or create one automatically on first login.
   * Called during the NextAuth signIn / session callback.
   */
  async findOrCreate(azureTenantId: string, name?: string): Promise<Tenant> {
    const existing = await this.findByAzureTenantId(azureTenantId)
    if (existing) return existing

    return prisma.tenant.create({
      data: {
        azureTenantId,
        name: name ?? 'My Organization',
        ticketProvider: 'none',
      },
    })
  }

  async updateTicketProvider(
    tenantId: string,
    provider: string,
    config: TicketProviderConfig
  ): Promise<Tenant> {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ticketProvider: provider,
        ticketConfig: JSON.stringify(config),
        updatedAt: new Date(),
      },
    })
  }

  async getTicketConfig(tenantId: string): Promise<TicketProviderConfig | null> {
    const tenant = await this.findById(tenantId)
    if (!tenant?.ticketConfig) return null
    try {
      return JSON.parse(tenant.ticketConfig) as TicketProviderConfig
    } catch {
      return null
    }
  }

  async getWorkerCheckpoint(tenantId: string): Promise<Pick<Tenant, 'id' | 'meetingSyncCheckpointAt' | 'checkpointUpdatedAt' | 'checkpointUpdatedByUserId' | 'checkpointUpdatedByEmail' | 'checkpointUpdateReason'> | null> {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        meetingSyncCheckpointAt: true,
        checkpointUpdatedAt: true,
        checkpointUpdatedByUserId: true,
        checkpointUpdatedByEmail: true,
        checkpointUpdateReason: true,
      },
    })
  }

  async setWorkerCheckpoint(
    tenantId: string,
    checkpoint: Date | null,
    actor: CheckpointActor,
    reason?: string | null
  ): Promise<Tenant> {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        meetingSyncCheckpointAt: checkpoint,
        checkpointUpdatedAt: new Date(),
        checkpointUpdatedByUserId: actor.userId,
        checkpointUpdatedByEmail: actor.email,
        checkpointUpdateReason: reason ?? null,
      },
    })
  }

  async update(id: string, data: Prisma.TenantUpdateInput): Promise<Tenant> {
    return prisma.tenant.update({ where: { id }, data })
  }
}
