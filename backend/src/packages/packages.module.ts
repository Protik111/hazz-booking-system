import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Package } from './entities/package.entity';
import { PackageTier } from './entities/package-tier.entity';
import { PackagesService } from './packages.service';
import {
  PackagesController,
  AdminPackagesController,
} from './packages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Package, PackageTier])],
  controllers: [PackagesController, AdminPackagesController],
  providers: [PackagesService],
  exports: [PackagesService, TypeOrmModule], // Export so BookingsModule can use PackageTier repository
})
export class PackagesModule {}
