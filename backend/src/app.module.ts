import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { getDatabaseConfig } from './config/database.config';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PackagesModule } from './packages/packages.module';
import { BookingsModule } from './bookings/bookings.module';
import { PilgrimsModule } from './pilgrims/pilgrims.module';
import { InstallmentsModule } from './installments/installments.module';
import { PaymentsModule } from './payments/payments.module';
import { CancellationModule } from './cancellation/cancellation.module';
import { RefundsModule } from './refunds/refunds.module';
import { VendorsModule } from './vendors/vendors.module';
import { InventoryModule } from './inventory/inventory.module';
import { AuditModule } from './audit/audit.module';
import { ReportModule } from './report/report.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { RedisModule } from './common/redis/redis.module';
import { ThrottlerModule } from './common/throttler/throttler.module';
import { AppThrottlerGuard } from './common/throttler/throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => getDatabaseConfig(config),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot({ global: true }),
    RedisModule,
    ThrottlerModule,
    AuthModule,
    UserModule,
    PackagesModule,
    BookingsModule,
    PilgrimsModule,
    InstallmentsModule,
    PaymentsModule,
    CancellationModule,
    RefundsModule,
    VendorsModule,
    InventoryModule,
    AuditModule,
    ReportModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      // Apply the named Throttler buckets (`short`, `auth`) defined on
      // individual endpoints. The guard runs after the JwtAuthGuard, so
      // unauthenticated traffic is still limited by IP.
      //
      // `AppThrottlerGuard` overrides `shouldSkip()` so that ONLY routes
      // carrying an explicit `@Throttle({ <bucket>: ... })` override are
      // rate-limited. Everything else (bookings, packages, reports, etc.)
      // bypasses the limiter — matching what the README promises.
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
