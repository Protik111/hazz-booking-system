import { Test, TestingModule } from '@nestjs/testing';
import {
  VendorsController,
  VendorExpensesController,
} from './vendors.controller';
import { VendorsService } from './vendors.service';
import { VendorType } from './enums/vendor-type.enum';
import { VendorStatus } from './enums/vendor-status.enum';

describe('Vendors and Expenses Controllers', () => {
  const mockVendorsService = {
    createVendor: jest.fn(),
    findAllVendors: jest.fn(),
    findOneVendor: jest.fn(),
    updateVendor: jest.fn(),
    removeVendor: jest.fn(),
    createExpense: jest.fn(),
    findAllExpenses: jest.fn(),
    findOneExpense: jest.fn(),
    updateExpense: jest.fn(),
    removeExpense: jest.fn(),
    getExpenseSummary: jest.fn(),
  };

  let vendorsController: VendorsController;
  let expensesController: VendorExpensesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorsController, VendorExpensesController],
      providers: [
        {
          provide: VendorsService,
          useValue: mockVendorsService,
        },
      ],
    }).compile();

    vendorsController = module.get<VendorsController>(VendorsController);
    expensesController = module.get<VendorExpensesController>(
      VendorExpensesController,
    );
  });

  describe('VendorsController', () => {
    it('POST /admin/vendors should create vendor', async () => {
      const dto = { name: 'Hilton', type: VendorType.HOTEL };
      mockVendorsService.createVendor.mockResolvedValue({ id: 'v-1', ...dto });

      const result = await vendorsController.create(dto);

      expect(result.id).toBe('v-1');
      expect(mockVendorsService.createVendor).toHaveBeenCalledWith(dto);
    });

    it('GET /admin/vendors should list vendors', async () => {
      mockVendorsService.findAllVendors.mockResolvedValue({
        data: [{ id: 'v-1' }],
        meta: { total: 1 },
      });

      const result = await vendorsController.findAll({
        status: VendorStatus.ACTIVE,
      });

      expect(result.data).toHaveLength(1);
      expect(mockVendorsService.findAllVendors).toHaveBeenCalledWith({
        status: VendorStatus.ACTIVE,
      });
    });

    it('GET /admin/vendors/:id should find single vendor', async () => {
      mockVendorsService.findOneVendor.mockResolvedValue({ id: 'v-1' });

      const result = await vendorsController.findOne('v-1');

      expect(result.id).toBe('v-1');
      expect(mockVendorsService.findOneVendor).toHaveBeenCalledWith('v-1');
    });

    it('PATCH /admin/vendors/:id should update vendor', async () => {
      mockVendorsService.updateVendor.mockResolvedValue({
        id: 'v-1',
        name: 'Updated',
      });

      const result = await vendorsController.update('v-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(mockVendorsService.updateVendor).toHaveBeenCalledWith('v-1', {
        name: 'Updated',
      });
    });

    it('DELETE /admin/vendors/:id should remove vendor', async () => {
      mockVendorsService.removeVendor.mockResolvedValue(undefined);

      await vendorsController.remove('v-1');

      expect(mockVendorsService.removeVendor).toHaveBeenCalledWith('v-1');
    });
  });

  describe('VendorExpensesController', () => {
    it('POST /admin/vendor-expenses should create expense', async () => {
      const dto = {
        vendor_id: 'v-1',
        expense_type: 'HOTEL',
        amount: 500,
        expense_date: '2026-09-21',
      };
      mockVendorsService.createExpense.mockResolvedValue({
        id: 'exp-1',
        ...dto,
      });

      const result = await expensesController.create('admin-1', dto);

      expect(result.id).toBe('exp-1');
      expect(mockVendorsService.createExpense).toHaveBeenCalledWith(
        'admin-1',
        dto,
      );
    });

    it('GET /admin/vendor-expenses/summary should return summary', async () => {
      const summary = { total_expenses_bdt: '50000.00' };
      mockVendorsService.getExpenseSummary.mockResolvedValue(summary);

      const result = await expensesController.getSummary();

      expect(result.total_expenses_bdt).toBe('50000.00');
    });

    it('GET /admin/vendor-expenses should list expenses', async () => {
      mockVendorsService.findAllExpenses.mockResolvedValue({
        data: [],
        meta: {},
      });

      await expensesController.findAll({ expense_type: 'HOTEL' });

      expect(mockVendorsService.findAllExpenses).toHaveBeenCalledWith({
        expense_type: 'HOTEL',
      });
    });

    it('GET /admin/vendor-expenses/:id should return single expense', async () => {
      mockVendorsService.findOneExpense.mockResolvedValue({ id: 'exp-1' });

      const result = await expensesController.findOne('exp-1');

      expect(result.id).toBe('exp-1');
    });

    it('PATCH /admin/vendor-expenses/:id should update expense', async () => {
      mockVendorsService.updateExpense.mockResolvedValue({
        id: 'exp-1',
        amount: '600.00',
      });

      const result = await expensesController.update('exp-1', { amount: 600 });

      expect(result.amount).toBe('600.00');
    });

    it('DELETE /admin/vendor-expenses/:id should remove expense', async () => {
      mockVendorsService.removeExpense.mockResolvedValue(undefined);

      await expensesController.remove('exp-1');

      expect(mockVendorsService.removeExpense).toHaveBeenCalledWith('exp-1');
    });
  });
});
