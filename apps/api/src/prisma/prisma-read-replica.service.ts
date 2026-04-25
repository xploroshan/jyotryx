import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaReadReplicaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaReadReplicaService.name);
  private readonly usingReplica: boolean;

  constructor() {
    // Pick the replica URL when configured, otherwise fall through to
    // the primary so existing call sites keep working in environments
    // without a separate read replica. Each client owns its own
    // adapter pool so primary and replica connections are independent.
    const replicaUrl = process.env.DATABASE_READ_REPLICA_URL || '';
    const url = replicaUrl || process.env.DATABASE_URL || '';

    super({
      adapter: new PrismaPg({ connectionString: url }),
    });

    this.usingReplica = replicaUrl.length > 0;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      if (this.usingReplica) {
        this.logger.log('Connected to read replica');
      } else {
        this.logger.log(
          'Read replica not configured, using primary (set DATABASE_READ_REPLICA_URL to enable)',
        );
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
