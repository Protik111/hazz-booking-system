import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { HealthController } from './health.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PackagesModule } from './packages/packages.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => getDatabaseConfig(config),
      inject: [ConfigService],
    }),
    AuthModule,
    WorkspaceModule,
    DocumentModule,
    UserModule,
    WorkspaceMemberModule,
    EventEmitterModule.forRoot({ global: true }),
    PackagesModule,
    BookingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
