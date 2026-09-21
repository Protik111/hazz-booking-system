import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Pilgrim } from '../pilgrims/entities/pilgrim.entity';
import { InventoryStatus } from './enums/inventory-status.enum';
import { InventoryTransactionType } from './enums/inventory-transaction-type.enum';

interface MockEntityManager {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

describe('InventoryService', () => {
  let service: InventoryService;

  const mockItemRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockTxRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
  };

  const mockPilgrimRepo = {
    findOne: jest.fn(),
  };

  let mockEntityManager: MockEntityManager;
  let mockDataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockEntityManager = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((_cls, data) => data),
      save: jest
        .fn()
        .mockImplementation((_cls, entity) => Promise.resolve(entity)),
    };

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: MockEntityManager) => Promise<unknown>) =>
            cb(mockEntityManager),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(InventoryItem), useValue: mockItemRepo },
        {
          provide: getRepositoryToken(InventoryTransaction),
          useValue: mockTxRepo,
        },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(Pilgrim), useValue: mockPilgrimRepo },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  // ─── Inventory Items ──────────────────────────────────────────────────────

  describe('Inventory Items', () => {
    it('createItem should create and save item', async () => {
      mockItemRepo.findOne.mockResolvedValue(null);
      const dto = { name: 'Ihram Set', sku: 'IHR-001', quantity: 100 };
      const created = { id: 'item-1', ...dto, status: InventoryStatus.ACTIVE };
      mockItemRepo.create.mockReturnValue(created);
      mockItemRepo.save.mockResolvedValue(created);

      const result = await service.createItem(dto);

      expect(result.id).toBe('item-1');
      expect(mockItemRepo.create).toHaveBeenCalledWith(dto);
      expect(mockItemRepo.save).toHaveBeenCalledWith(created);
    });

    it('createItem should throw ConflictException if SKU exists', async () => {
      mockItemRepo.findOne.mockResolvedValue({ id: 'item-existing' });

      await expect(
        service.createItem({ name: 'Ihram', sku: 'IHR-001' }),
      ).rejects.toThrow(ConflictException);
    });

    it('findAllItems should handle search, status, and low_stock', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'item-1' }], 1]),
      };
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllItems({
        search: 'Ihram',
        status: InventoryStatus.ACTIVE,
        low_stock: true,
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
      expect(result.data).toHaveLength(1);
    });

    it('findOneItem should throw NotFoundException if missing', async () => {
      mockItemRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneItem('item-99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updateItem should update fields and save', async () => {
      const item = { id: 'item-1', sku: 'OLD-SKU', name: 'Old' };
      mockItemRepo.findOne.mockResolvedValue(item);
      mockItemRepo.save.mockImplementation((i) => Promise.resolve(i));

      const result = await service.updateItem('item-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('removeItem should soft remove item', async () => {
      const item = { id: 'item-1' };
      mockItemRepo.findOne.mockResolvedValue(item);
      mockItemRepo.softRemove.mockResolvedValue(item);

      await service.removeItem('item-1');

      expect(mockItemRepo.softRemove).toHaveBeenCalledWith(item);
    });

    it('getLowStockItems should query items below minimum_stock', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'item-1', quantity: 2 }]),
      };
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getLowStockItems();

      expect(result).toHaveLength(1);
      expect(qb.where).toHaveBeenCalledWith(
        'item.quantity <= item.minimum_stock',
      );
    });
  });

  // ─── Inventory Transactions ───────────────────────────────────────────────

  describe('Inventory Transactions', () => {
    it('createTransaction should throw NotFoundException if item missing', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createTransaction('user-1', {
          inventory_item_id: 'item-99',
          type: InventoryTransactionType.PURCHASE,
          quantity: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('createTransaction PURCHASE should increase stock', async () => {
      const item = {
        id: 'item-1',
        name: 'Ihram',
        quantity: 50,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(item);

      const result = await service.createTransaction('user-1', {
        inventory_item_id: 'item-1',
        type: InventoryTransactionType.PURCHASE,
        quantity: 25,
        notes: 'Restocked',
      });

      expect(item.quantity).toBe(75); // 50 + 25
      expect(result.type).toBe(InventoryTransactionType.PURCHASE);
      expect(result.created_by_id).toBe('user-1');
    });

    it('createTransaction RETURN should increase stock', async () => {
      const item = {
        id: 'item-1',
        name: 'Luggage Bag',
        quantity: 20,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(item);

      await service.createTransaction('user-1', {
        inventory_item_id: 'item-1',
        type: InventoryTransactionType.RETURN,
        quantity: 5,
      });

      expect(item.quantity).toBe(25); // 20 + 5
    });

    it('createTransaction ISSUE should throw BadRequestException if insufficient stock', async () => {
      const item = {
        id: 'item-1',
        name: 'SIM Card',
        quantity: 3,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(item);

      await expect(
        service.createTransaction('user-1', {
          inventory_item_id: 'item-1',
          type: InventoryTransactionType.ISSUE,
          quantity: 5, // 5 > 3
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('createTransaction ISSUE should deduct stock when sufficient', async () => {
      const item = {
        id: 'item-1',
        name: 'SIM Card',
        quantity: 10,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(item);

      await service.createTransaction('user-1', {
        inventory_item_id: 'item-1',
        type: InventoryTransactionType.ISSUE,
        quantity: 4,
      });

      expect(item.quantity).toBe(6); // 10 - 4
    });

    it('createTransaction ADJUSTMENT should throw BadRequestException if resulting stock negative', async () => {
      const item = {
        id: 'item-1',
        name: 'Ihram',
        quantity: 5,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(item);

      await expect(
        service.createTransaction('user-1', {
          inventory_item_id: 'item-1',
          type: InventoryTransactionType.ADJUSTMENT,
          quantity: -10, // 5 - 10 = -5 < 0
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('createTransaction ADJUSTMENT should adjust stock when valid', async () => {
      const item = {
        id: 'item-1',
        name: 'Ihram',
        quantity: 20,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(item);

      await service.createTransaction('user-1', {
        inventory_item_id: 'item-1',
        type: InventoryTransactionType.ADJUSTMENT,
        quantity: -5,
      });

      expect(item.quantity).toBe(15);
    });

    it('findAllTransactions should query with filters and pagination', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'tx-1' }], 1]),
      };
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllTransactions({
        inventory_item_id: 'item-1',
        type: InventoryTransactionType.ISSUE,
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });
});
