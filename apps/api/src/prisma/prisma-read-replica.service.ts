import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaReadReplicaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaReadReplicaService.name);
  private readonly usingReplica: boolean;

  constructor() {
    // Prisma 7 dropped the `datasources` constructor option, so we can no
    // longer point this client at `DATABASE_READ_REPLICA_URL` separately
    // from the primary's `DATABASE_URL` without a driver adapter. For now
    // both clients share the primary URL; the replica wiring is a
    // follow-up that needs `@prisma/adapter-pg`. The split client is kept
    // so call sites that already use it don't have to change when the
    // replica adapter lands.
    super();

    const usingReplica = (process.env.DATABASE_READ_REPLICA_URL || '').length > 0;
    (this as any).__usingReplica = usingReplica;
    this.usingReplica = usingReplica;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      if (this.usingReplica) {
        this.logger.warn(
          'DATABASE_READ_REPLICA_URL is set but Prisma 7 ignores it without a driver adapter; using primary',
        );
      } else {
        this.logger.log('Read replica not configured, using primary');
      }
    } catch (error) {
      this.logger.error(`Read replica connection failed: ${error}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from read replica');
  }
}
