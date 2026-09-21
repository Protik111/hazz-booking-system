import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { Vendor } from './entities/vendor.entity';
import { VendorExpense } from './entities/vendor-expense.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Package } from '../packages/entities/package.entity';
import { VendorType } from './enums/vendor-type.enum';
import { VendorStatus } from './enums/vendor-status.enum';
import { ExpenseStatus } from './enums/expense-status.enum';

describe('VendorsService', () => {
  let service: VendorsService;

  const mockVendorRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockExpenseRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    remove: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
  };

  const mockPackageRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        { provide: getRepositoryToken(Vendor), useValue: mockVendorRepo },
        {
          provide: getRepositoryToken(VendorExpense),
          useValue: mockExpenseRepo,
        },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Package), useValue: mockPackageRepo },
      ],
    }).compile();

    service = module.get<VendorsService>(VendorsService);
  });

  // ─── Vendor CRUD ────────────────────────────────────────────────────────

  describe('Vendor CRUD', () => {
    it('createVendor should save and return new vendor', async () => {
      const dto = {
        name: 'Makkah Hilton',
        type: VendorType.HOTEL,
        contact_email: 'hilton@makkah.com',
      };
      const created = { id: 'v-1', ...dto, status: VendorStatus.ACTIVE };
      mockVendorRepo.create.mockReturnValue(created);
      mockVendorRepo.save.mockResolvedValue(created);

      const result = await service.createVendor(dto);

      expect(result.id).toBe('v-1');
      expect(mockVendorRepo.create).toHaveBeenCalledWith(dto);
      expect(mockVendorRepo.save).toHaveBeenCalledWith(created);
    });

    it('findAllVendors should query with filters and pagination', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'v-1' }], 1]),
      };
      mockVendorRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllVendors({
        search: 'Hilton',
        type: VendorType.HOTEL,
        status: VendorStatus.ACTIVE,
        page: 1,
        limit: 10,
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('findOneVendor should throw NotFoundException if vendor missing', async () => {
      mockVendorRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneVendor('v-99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updateVendor should merge and save updates', async () => {
      const vendor = { id: 'v-1', name: 'Old Name' };
      mockVendorRepo.findOne.mockResolvedValue(vendor);
      mockVendorRepo.save.mockImplementation((v) => Promise.resolve(v));

      const result = await service.updateVendor('v-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(mockVendorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' }),
      );
    });

    it('removeVendor should soft remove vendor', async () => {
      const vendor = { id: 'v-1' };
      mockVendorRepo.findOne.mockResolvedValue(vendor);
      mockVendorRepo.softRemove.mockResolvedValue(vendor);

      await service.removeVendor('v-1');

      expect(mockVendorRepo.softRemove).toHaveBeenCalledWith(vendor);
    });
  });

  // ─── Vendor Expenses ────────────────────────────────────────────────────

  describe('Vendor Expenses', () => {
    it('createExpense should throw NotFoundException if vendor does not exist', async () => {
      mockVendorRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createExpense('admin-1', {
          vendor_id: 'v-99',
          expense_type: 'HOTEL',
          amount: 1000,
          currency: 'SAR',
          exchange_rate: 32.5,
          expense_date: '2026-09-21',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('createExpense should throw NotFoundException if booking does not exist', async () => {
      mockVendorRepo.findOne.mockResolvedValue({ id: 'v-1' });
      mockBookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createExpense('admin-1', {
          vendor_id: 'v-1',
          booking_id: 'b-99',
          expense_type: 'HOTEL',
          amount: 1000,
          expense_date: '2026-09-21',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('createExpense should throw NotFoundException if package does not exist', async () => {
      mockVendorRepo.findOne.mockResolvedValue({ id: 'v-1' });
      mockPackageRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createExpense('admin-1', {
          vendor_id: 'v-1',
          package_id: 'p-99',
          expense_type: 'HOTEL',
          amount: 1000,
          expense_date: '2026-09-21',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('createExpense should calculate amount_bdt accurately based on exchange_rate', async () => {
      mockVendorRepo.findOne.mockResolvedValue({ id: 'v-1' });

      const dto = {
        vendor_id: 'v-1',
        expense_type: 'HOTEL',
        amount: 2000,
        currency: 'SAR',
        exchange_rate: 32.5,
        expense_date: '2026-09-21',
        status: ExpenseStatus.PENDING,
        notes: 'Hotel deposit',
      };

      // 2000 * 32.5 = 65000.00 BDT
      const created = {
        id: 'exp-1',
        ...dto,
        amount: '2000.00',
        exchange_rate: '32.5000',
        amount_bdt: '65000.00',
        created_by_id: 'admin-1',
      };

      mockExpenseRepo.create.mockReturnValue(created);
      mockExpenseRepo.save.mockResolvedValue(created);

      const result = await service.createExpense('admin-1', dto);

      expect(mockExpenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '2000.00',
          currency: 'SAR',
          exchange_rate: '32.5000',
          amount_bdt: '65000.00',
          created_by_id: 'admin-1',
        }),
      );
      expect(result.amount_bdt).toBe('65000.00');
    });

    it('updateExpense should recompute amount_bdt when amount or rate changes', async () => {
      const expense = {
        id: 'exp-1',
        vendor_id: 'v-1',
        amount: '1000.00',
        exchange_rate: '30.0000',
        amount_bdt: '30000.00',
      };
      mockExpenseRepo.findOne.mockResolvedValue(expense);
      mockExpenseRepo.save.mockImplementation((e) => Promise.resolve(e));

      // Change amount to 1500 with rate 32: 1500 * 32 = 48000.00
      const result = await service.updateExpense('exp-1', {
        amount: 1500,
        exchange_rate: 32,
      });

      expect(result.amount).toBe('1500.00');
      expect(result.exchange_rate).toBe('32.0000');
      expect(result.amount_bdt).toBe('48000.00');
    });

    it('getExpenseSummary should aggregate total BDT and breakdowns', async () => {
      mockExpenseRepo.find.mockResolvedValue([
        {
          id: 'exp-1',
          vendor_id: 'v-1',
          vendor: { name: 'Makkah Hotel' },
          currency: 'SAR',
          amount: '1000.00',
          amount_bdt: '32000.00',
          expense_type: 'HOTEL',
        },
        {
          id: 'exp-2',
          vendor_id: 'v-2',
          vendor: { name: 'Saudia Airline' },
          currency: 'BDT',
          amount: '50000.00',
          amount_bdt: '50000.00',
          expense_type: 'AIRLINE',
        },
      ]);

      const summary = await service.getExpenseSummary();

      expect(summary.total_expenses_bdt).toBe('82000.00');
      expect(summary.count).toBe(2);
      expect(summary.by_currency['SAR']).toBe(1000);
      expect(summary.by_currency['BDT']).toBe(50000);
      expect(summary.by_type['HOTEL']).toBe(32000);
      expect(summary.by_type['AIRLINE']).toBe(50000);
      expect(summary.by_vendor['v-1'].vendor_name).toBe('Makkah Hotel');
      expect(summary.by_vendor['v-1'].total_bdt).toBe(32000);
    });
  });
});
