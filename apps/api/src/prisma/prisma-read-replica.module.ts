import { Global, Module } from '@nestjs/common';
import { PrismaReadReplicaService } from './prisma-read-replica.service';

@Global()
@Module({
  providers: [PrismaReadReplicaService],
  exports: [PrismaReadReplicaService],
})
export class PrismaReadReplicaModule {}
