import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL || '';
    // Render PostgreSQL requires SSL — append sslmode if not already present
    const needsSsl =
      process.env.NODE_ENV === 'production' &&
      url.length > 0 &&
      !url.includes('sslmode=');
    const datasourceUrl = needsSsl
      ? `${url}${url.includes('?') ? '&' : '?'}sslmode=require`
      : url;

    super({
      datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to database');
    } catch (error) {
      this.logger.error(`Database connection failed: ${error}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }
}
