import { Global, Module } from '@nestjs/common';
import { MyLogger } from './logger.service';
@Global()
@Module({
  controllers: [],
  providers: [MyLogger],
  exports: [MyLogger],
})
export class LoggerModule {}
