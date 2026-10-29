import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaReplicaService } from './prisma-replica.service';
import { ReplicaFailoverService } from './replica-failover.service';
@Global()
@Module({
  controllers: [],
  providers: [PrismaService, PrismaReplicaService, ReplicaFailoverService],
  exports: [PrismaService, PrismaReplicaService, ReplicaFailoverService],
})
export class PrismaModule {}
