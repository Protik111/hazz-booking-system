import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => getDatabaseConfig(config),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot({ global: true }),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
