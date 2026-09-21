import { Module } from '@nestjs/common';
import { CancellationService } from './cancellation.service';
import { CancellationController } from './cancellation.controller';

@Module({
  controllers: [CancellationController],
  providers: [CancellationService],
})
export class CancellationModule {}
