import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../user/enums/user-role.enum';
import { ListPackagesQueryDto } from './dto/list-packages-query.dto';
import { PackageAvailabilityQueryDto } from './dto/package-availability.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { UpdateTierQuotaDto } from './dto/update-tier-quota.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

// ─── Public Package Routes ────────────────────────────────────────────────────

@ApiTags('Packages')
@Public()
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  async listPublished(@Query() query: ListPackagesQueryDto) {
    return this.packagesService.listPublished(query);
  }

  // NOTE: this MUST be declared before `@Get(':id')` so the literal
  // `availability` segment isn't captured by the UUID param route.
  @Get('availability')
  async availability(@Query() query: PackageAvailabilityQueryDto) {
    return this.packagesService.getAvailability(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.packagesService.findOnePublic(id);
  }
}

// ─── Admin Package Routes ─────────────────────────────────────────────────────

@ApiTags('Admin Packages')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminPackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get('packages')
  async listAll(@Query() query: ListPackagesQueryDto) {
    return this.packagesService.adminListAll(query);
  }

  @Get('packages/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.packagesService.findOneAdmin(id);
  }

  @Post('packages')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePackageDto) {
    return this.packagesService.createPackage(dto);
  }

  @Patch('packages/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.packagesService.updatePackage(id, dto);
  }

  @Delete('packages/:id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.packagesService.deletePackage(id);
  }

  @Post('packages/:packageId/tiers')
  @HttpCode(HttpStatus.CREATED)
  async createTier(
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() dto: CreateTierDto,
  ) {
    return this.packagesService.createTier(packageId, dto);
  }

  @Patch('tiers/:id')
  async updateTier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTierDto,
  ) {
    return this.packagesService.updateTier(id, dto);
  }

  @Patch('tiers/:id/quota')
  async updateTierQuota(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTierQuotaDto,
  ) {
    return this.packagesService.updateTierQuota(id, dto);
  }
}
