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
import {
  AvailabilityMonthBucket,
  PackageAvailabilityQueryDto,
  PackageAvailabilityResponse,
} from './dto/package-availability.dto';
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

  /**
   * Returns month-bucket counts + a sparse map of days that have at least one
   * published package. Powers the public /packages calendar UI so users can
   * see at a glance which dates are bookable.
   */
  async getAvailability(
    query: PackageAvailabilityQueryDto,
  ): Promise<PackageAvailabilityResponse> {
    const year = query.year ?? new Date().getUTCFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;

    const monthQb = this.packageRepo
      .createQueryBuilder('p')
      .select(`to_char(date_trunc('month', p.departure_date), 'YYYY-MM')`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where('p.status = :status', { status: PackageStatus.PUBLISHED })
      .andWhere('p.departure_date >= :yearStart', { yearStart })
      .andWhere('p.departure_date < :yearEnd', { yearEnd });
    if (query.type) monthQb.andWhere('p.type = :type', { type: query.type });
    const monthRows: Array<{ bucket: string; count: string }> =
      await monthQb.groupBy('bucket').orderBy('bucket', 'ASC').getRawMany();

    const dayQb = this.packageRepo
      .createQueryBuilder('p')
      .select(`to_char(p.departure_date, 'YYYY-MM-DD')`, 'day')
      .where('p.status = :status', { status: PackageStatus.PUBLISHED })
      .andWhere('p.departure_date >= :yearStart', { yearStart })
      .andWhere('p.departure_date < :yearEnd', { yearEnd });
    if (query.type) dayQb.andWhere('p.type = :type', { type: query.type });
    const dayRows: Array<{ day: string }> = await dayQb.groupBy('day').getRawMany();

    // The months list always contains 12 entries so the calendar UI can
    // render every cell even when a month has no packages.
    const monthMap = new Map<string, number>(
      monthRows.map((row) => [
        row.bucket,
        typeof row.count === 'string' ? parseInt(row.count, 10) : Number(row.count),
      ]),
    );
    const months: AvailabilityMonthBucket[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      months.push({ month: key, count: monthMap.get(key) ?? 0 });
    }

    const days: Record<string, boolean> = {};
    for (const row of dayRows) {
      days[row.day] = true;
    }

    return {
      type: query.type ?? 'ALL',
      year,
      months,
      days,
    };
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

  /**
   * Admin-only single-package lookup. Unlike `findOnePublic`, this does NOT
   * filter by `status` so admins can see DRAFT/CLOSED/CANCELLED packages too.
   * Powers the admin package edit page.
   */
  async findOneAdmin(id: string) {
    const pkg = await this.packageRepo.findOne({
      where: { id },
      relations: ['tiers'],
    });
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    return pkg;
  }

  async createPackage(dto: CreatePackageDto) {
    const slug = await this.generateUniqueSlug(dto.name);

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
      const newSlug = await this.generateUniqueSlug(dto.name, id);
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

  /**
   * Slugify a package name and guarantee uniqueness across the table —
   * including soft-deleted rows, because the DB unique constraint covers
   * every row regardless of `deleted_at`. If the base slug is taken, append
   * `-2`, `-3`, … until free. `ignoreId` lets updates skip their own row.
   */
  private async generateUniqueSlug(
    name: string,
    ignoreId?: string,
  ): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const conflict = await this.packageRepo.findOne({
        where: { slug: candidate },
        withDeleted: true,
      });
      if (!conflict || conflict.id === ignoreId) {
        return candidate;
      }
    }

    // Fallback: random suffix. Should be effectively unreachable.
    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
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
