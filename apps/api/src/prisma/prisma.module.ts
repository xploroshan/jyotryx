import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaReadReplicaService } from './prisma-read-replica.service';

@Global()
@Module({
  providers: [PrismaService, PrismaReadReplicaService],
  exports: [PrismaService, PrismaReadReplicaService],
})
export class PrismaModule {}
