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
    const replicaUrl = process.env.DATABASE_READ_REPLICA_URL || '';
    const primaryUrl = process.env.DATABASE_URL || '';
    const url = replicaUrl || primaryUrl;
    const isProduction = process.env.NODE_ENV === 'production';

    const needsSsl = isProduction && url.length > 0 && !url.includes('sslmode=');
    const datasourceUrl = needsSsl
      ? `${url}${url.includes('?') ? '&' : '?'}sslmode=require`
      : url;

    super({
      datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    });

    // Track whether we're actually using a separate replica
    const usingReplica = replicaUrl.length > 0;
    // Store as a field accessible after super()
    (this as any).__usingReplica = usingReplica;
    this.usingReplica = usingReplica;
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
