import { Test, TestingModule } from '@nestjs/testing';
import {
  PackagesController,
  AdminPackagesController,
} from './packages.controller';
import { PackagesService } from './packages.service';
import { PackageType } from './enums/package-type.enum';
import { TierName } from './enums/tier-name.enum';

describe('PackagesController & AdminPackagesController', () => {
  let publicController: PackagesController;
  let adminController: AdminPackagesController;

  const mockPackagesService = {
    listPublished: jest.fn(),
    findOnePublic: jest.fn(),
    adminListAll: jest.fn(),
    createPackage: jest.fn(),
    updatePackage: jest.fn(),
    deletePackage: jest.fn(),
    createTier: jest.fn(),
    updateTier: jest.fn(),
    updateTierQuota: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackagesController, AdminPackagesController],
      providers: [
        {
          provide: PackagesService,
          useValue: mockPackagesService,
        },
      ],
    }).compile();

    publicController = module.get<PackagesController>(PackagesController);
    adminController = module.get<AdminPackagesController>(
      AdminPackagesController,
    );
  });

  it('should be defined', () => {
    expect(publicController).toBeDefined();
    expect(adminController).toBeDefined();
  });

  describe('Public Endpoints', () => {
    it('GET /packages should call listPublished', async () => {
      mockPackagesService.listPublished.mockResolvedValue({
        data: [],
        meta: {},
      });

      await publicController.listPublished({ page: 1, limit: 10 });

      expect(mockPackagesService.listPublished).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      });
    });

    it('GET /packages/:id should call findOnePublic', async () => {
      mockPackagesService.findOnePublic.mockResolvedValue({ id: 'uuid-1' });

      await publicController.findOne('uuid-1');

      expect(mockPackagesService.findOnePublic).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('Admin Endpoints', () => {
    it('POST /admin/packages should create a package', async () => {
      const dto = {
        name: 'Hajj 2027',
        type: PackageType.HAJJ,
        departure_date: '2027-05-20',
        return_date: '2027-06-05',
        booking_start: '2026-01-01T00:00:00Z',
        booking_end: '2027-04-01T00:00:00Z',
      };
      mockPackagesService.createPackage.mockResolvedValue({
        id: 'pkg-1',
        ...dto,
      });

      const result = await adminController.create(dto);

      expect(result.id).toBe('pkg-1');
      expect(mockPackagesService.createPackage).toHaveBeenCalledWith(dto);
    });

    it('POST /admin/packages/:packageId/tiers should create a tier', async () => {
      const dto = {
        name: TierName.STANDARD,
        price: 550000,
        total_quota: 100,
      };
      mockPackagesService.createTier.mockResolvedValue({
        id: 'tier-1',
        ...dto,
      });

      const result = await adminController.createTier('pkg-1', dto);

      expect(result.id).toBe('tier-1');
      expect(mockPackagesService.createTier).toHaveBeenCalledWith('pkg-1', dto);
    });

    it('PATCH /admin/tiers/:id/quota should update quota', async () => {
      mockPackagesService.updateTierQuota.mockResolvedValue({
        id: 'tier-1',
        total_quota: 120,
      });

      const result = await adminController.updateTierQuota('tier-1', {
        total_quota: 120,
      });

      expect(result.total_quota).toBe(120);
      expect(mockPackagesService.updateTierQuota).toHaveBeenCalledWith(
        'tier-1',
        {
          total_quota: 120,
        },
      );
    });
  });
});
