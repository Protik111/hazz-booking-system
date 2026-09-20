import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindManyOptions,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Package } from './entities/package.entity';
import { PackageTier } from './entities/package-tier.entity';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { UpdateTierQuotaDto } from './dto/update-tier-quota.dto';
import { ListPackagesQueryDto } from './dto/list-packages-query.dto';
import { PackageStatus } from './enums/package-status.enum';
import { TierStatus } from './enums/tier-name.enum';

@Injectable()
export class PackagesService {
  constructor(
    @InjectRepository(Package)
    private readonly packageRepo: Repository<Package>,
    @InjectRepository(PackageTier)
    private readonly tierRepo: Repository<PackageTier>,
  ) {}

  // ─── Public APIs ────────────────────────────────────────────────────────────

  async listPublished(query: ListPackagesQueryDto) {
    const {
      type,
      departure_from,
      departure_to,
      page = 1,
      limit = 20,
      sort,
    } = query;

    const where: FindManyOptions<Package>['where'] = {
      status: PackageStatus.PUBLISHED,
    };

    if (type) {
      Object.assign(where, { type });
    }
    if (departure_from) {
      Object.assign(where, { departure_date: MoreThanOrEqual(departure_from) });
    }
    if (departure_to) {
      Object.assign(where, { departure_date: LessThanOrEqual(departure_to) });
    }

    // Parse sort: 'departure_date:asc' → ['departure_date', 'ASC']
    let order: FindManyOptions<Package>['order'] = { departure_date: 'ASC' };
    if (sort) {
      const [field, direction] = sort.split(':');
      const allowedFields = [
        'departure_date',
        'created_at',
        'name',
        'booking_start',
      ];
      if (field && allowedFields.includes(field)) {
        const dir =
          direction?.toUpperCase() === 'DESC'
            ? ('DESC' as const)
            : ('ASC' as const);
        order = { [field]: dir };
      }
    }

    const skip = (page - 1) * limit;
    const [packages, total] = await this.packageRepo.findAndCount({
      where,
      order,
      skip,
      take: limit,
      relations: ['tiers'],
    });

    return {
      data: packages.map((pkg) => this.toPublicResponse(pkg)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOnePublic(id: string) {
    const pkg = await this.packageRepo.findOne({
      where: { id, status: PackageStatus.PUBLISHED },
      relations: ['tiers'],
    });
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    return this.toPublicResponse(pkg);
  }

  // ─── Admin APIs ──────────────────────────────────────────────────────────────

  async adminListAll(query: ListPackagesQueryDto) {
    const { type, status, page = 1, limit = 20 } = query;
    const where: Record<string, unknown> = {};
    if (type) where['type'] = type;
    if (status) where['status'] = status;

    const [packages, total] = await this.packageRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
      relations: ['tiers'],
    });

    return {
      data: packages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createPackage(dto: CreatePackageDto) {
    const slug = this.generateSlug(dto.name);

    const existing = await this.packageRepo.findOne({ where: { slug } });
    if (existing) {
      throw new BadRequestException(
        `A package with slug "${slug}" already exists`,
      );
    }

    const pkg = this.packageRepo.create({
      name: dto.name,
      slug,
      type: dto.type,
      description: dto.description ?? null,
      departure_date: dto.departure_date,
      return_date: dto.return_date,
      booking_start: new Date(dto.booking_start),
      booking_end: new Date(dto.booking_end),
    });

    if (dto.tiers && dto.tiers.length > 0) {
      pkg.tiers = dto.tiers.map((tierDto) =>
        this.tierRepo.create({
          name: tierDto.name,
          price: tierDto.price.toFixed(2),
          currency: tierDto.currency ?? 'BDT',
          total_quota: tierDto.total_quota,
          held_seats: 0,
          confirmed_seats: 0,
        }),
      );
    }

    return this.packageRepo.save(pkg);
  }

  async updatePackage(id: string, dto: UpdatePackageDto) {
    const pkg = await this.packageRepo.findOne({
      where: { id },
      withDeleted: false,
    });
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (dto.name && dto.name !== pkg.name) {
      const newSlug = this.generateSlug(dto.name);
      const conflict = await this.packageRepo.findOne({
        where: { slug: newSlug },
      });
      if (conflict && conflict.id !== id) {
        throw new BadRequestException(`Slug "${newSlug}" is already taken`);
      }
      pkg.slug = newSlug;
    }

    Object.assign(pkg, {
      name: dto.name ?? pkg.name,
      type: dto.type ?? pkg.type,
      description:
        dto.description !== undefined ? dto.description : pkg.description,
      departure_date: dto.departure_date ?? pkg.departure_date,
      return_date: dto.return_date ?? pkg.return_date,
      booking_start: dto.booking_start
        ? new Date(dto.booking_start)
        : pkg.booking_start,
      booking_end: dto.booking_end
        ? new Date(dto.booking_end)
        : pkg.booking_end,
      status: dto.status ?? pkg.status,
    });

    return this.packageRepo.save(pkg);
  }

  async deletePackage(id: string) {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    await this.packageRepo.softDelete(id);
    return { message: 'Package deleted successfully' };
  }

  // ─── Tier Admin APIs ─────────────────────────────────────────────────────────

  async createTier(packageId: string, dto: CreateTierDto) {
    const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    // Prevent duplicate tier names in the same package
    const existing = await this.tierRepo.findOne({
      where: { package_id: packageId, name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(
        `A ${dto.name} tier already exists for this package`,
      );
    }

    const tier = this.tierRepo.create({
      package_id: packageId,
      name: dto.name,
      price: dto.price.toFixed(2),
      currency: dto.currency ?? 'BDT',
      total_quota: dto.total_quota,
      held_seats: 0,
      confirmed_seats: 0,
    });

    return this.tierRepo.save(tier);
  }

  async updateTier(tierId: string, dto: UpdateTierDto) {
    const tier = await this.tierRepo.findOne({ where: { id: tierId } });
    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    // If price changes, it only affects future bookings (existing bookings have frozen unit_price)
    if (dto.price !== undefined) tier.price = dto.price.toFixed(2);
    if (dto.currency !== undefined) tier.currency = dto.currency;
    if (dto.status !== undefined) tier.status = dto.status;
    // total_quota changes go through the dedicated quota endpoint

    return this.tierRepo.save(tier);
  }

  async updateTierQuota(tierId: string, dto: UpdateTierQuotaDto) {
    const tier = await this.tierRepo.findOne({ where: { id: tierId } });
    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    // DB invariant: quota >= held_seats + confirmed_seats
    const committedSeats = tier.held_seats + tier.confirmed_seats;
    if (dto.total_quota < committedSeats) {
      throw new BadRequestException(
        `Cannot reduce quota below committed seats. Current committed: ${committedSeats} (${tier.held_seats} held + ${tier.confirmed_seats} confirmed).`,
      );
    }

    tier.total_quota = dto.total_quota;
    return this.tierRepo.save(tier);
  }

  async findTierById(tierId: string): Promise<PackageTier | null> {
    return this.tierRepo.findOne({ where: { id: tierId } });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private toPublicResponse(pkg: Package) {
    return {
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      type: pkg.type,
      description: pkg.description,
      departure_date: pkg.departure_date,
      return_date: pkg.return_date,
      booking_start: pkg.booking_start,
      booking_end: pkg.booking_end,
      status: pkg.status,
      tiers: (pkg.tiers ?? [])
        .filter((t) => t.status === TierStatus.ACTIVE)
        .map((t) => ({
          id: t.id,
          name: t.name,
          price: t.price,
          currency: t.currency,
          total_quota: t.total_quota,
          available_seats: t.total_quota - t.held_seats - t.confirmed_seats,
        })),
      created_at: pkg.created_at,
      updated_at: pkg.updated_at,
    };
  }
}
