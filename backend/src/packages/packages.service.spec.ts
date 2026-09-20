import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { Package } from './entities/package.entity';
import { PackageTier } from './entities/package-tier.entity';
import { PackageType } from './enums/package-type.enum';
import { PackageStatus } from './enums/package-status.enum';
import { TierName, TierStatus } from './enums/tier-name.enum';

describe('PackagesService', () => {
  let service: PackagesService;

  const mockTier: PackageTier = {
    id: 'tier-uuid-1',
    package_id: 'package-uuid-1',
    package: null as unknown as Package,
    name: TierName.ECONOMY,
    price: '450000.00',
    currency: 'BDT',
    total_quota: 50,
    held_seats: 10,
    confirmed_seats: 15,
    status: TierStatus.ACTIVE,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockPackage: Package = {
    id: 'package-uuid-1',
    name: 'Hajj Premium 2027',
    slug: 'hajj-premium-2027',
    type: PackageType.HAJJ,
    description: 'A premium Hajj package',
    departure_date: '2027-05-20',
    return_date: '2027-06-05',
    booking_start: new Date('2026-01-01'),
    booking_end: new Date('2027-04-01'),
    status: PackageStatus.PUBLISHED,
    tiers: [mockTier],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockPackageRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockTierRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagesService,
        {
          provide: getRepositoryToken(Package),
          useValue: mockPackageRepo,
        },
        {
          provide: getRepositoryToken(PackageTier),
          useValue: mockTierRepo,
        },
      ],
    }).compile();

    service = module.get<PackagesService>(PackagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listPublished', () => {
    it('should return published packages with available seats calculated', async () => {
      mockPackageRepo.findAndCount.mockResolvedValue([[mockPackage], 1]);

      const result = await service.listPublished({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockPackage.id);
      expect(result.data[0].tiers[0].available_seats).toBe(25); // 50 - 10 - 15 = 25
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOnePublic', () => {
    it('should return package if published and found', async () => {
      mockPackageRepo.findOne.mockResolvedValue(mockPackage);

      const result = await service.findOnePublic('package-uuid-1');

      expect(result.id).toBe(mockPackage.id);
      expect(result.name).toBe('Hajj Premium 2027');
    });

    it('should throw NotFoundException if package does not exist or not published', async () => {
      mockPackageRepo.findOne.mockResolvedValue(null);

      await expect(service.findOnePublic('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createPackage', () => {
    it('should create package and generate slug', async () => {
      mockPackageRepo.findOne.mockResolvedValue(null);
      mockPackageRepo.create.mockReturnValue({ ...mockPackage });
      mockPackageRepo.save.mockResolvedValue(mockPackage);

      const result = await service.createPackage({
        name: 'Hajj Premium 2027',
        type: PackageType.HAJJ,
        departure_date: '2027-05-20',
        return_date: '2027-06-05',
        booking_start: '2026-01-01T00:00:00Z',
        booking_end: '2027-04-01T00:00:00Z',
      });

      expect(result.slug).toBe('hajj-premium-2027');
      expect(mockPackageRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if slug is already in use', async () => {
      mockPackageRepo.findOne.mockResolvedValue(mockPackage);

      await expect(
        service.createPackage({
          name: 'Hajj Premium 2027',
          type: PackageType.HAJJ,
          departure_date: '2027-05-20',
          return_date: '2027-06-05',
          booking_start: '2026-01-01T00:00:00Z',
          booking_end: '2027-04-01T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTierQuota', () => {
    it('should successfully update quota when new quota >= committed seats', async () => {
      mockTierRepo.findOne.mockResolvedValue({ ...mockTier }); // held: 10, confirmed: 15, committed: 25
      mockTierRepo.save.mockImplementation((t: PackageTier) =>
        Promise.resolve(t),
      );

      const result = await service.updateTierQuota('tier-uuid-1', {
        total_quota: 30,
      });

      expect(result.total_quota).toBe(30);
    });

    it('should throw BadRequestException when reducing quota below committed seats', async () => {
      mockTierRepo.findOne.mockResolvedValue({ ...mockTier }); // committed = 25

      await expect(
        service.updateTierQuota('tier-uuid-1', { total_quota: 20 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
