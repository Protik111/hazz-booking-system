import { Test, TestingModule } from '@nestjs/testing';
import {
  InventoryItemsController,
  InventoryTransactionsController,
} from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryTransactionType } from './enums/inventory-transaction-type.enum';

describe('Inventory Controllers', () => {
  const mockInventoryService = {
    createItem: jest.fn(),
    findAllItems: jest.fn(),
    findOneItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    getLowStockItems: jest.fn(),
    createTransaction: jest.fn(),
    findAllTransactions: jest.fn(),
  };

  let itemsController: InventoryItemsController;
  let txController: InventoryTransactionsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryItemsController, InventoryTransactionsController],
      providers: [
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    itemsController = module.get<InventoryItemsController>(
      InventoryItemsController,
    );
    txController = module.get<InventoryTransactionsController>(
      InventoryTransactionsController,
    );
  });

  describe('InventoryItemsController', () => {
    it('POST /admin/inventory/items should create item', async () => {
      const dto = { name: 'Ihram', sku: 'IHR-001', quantity: 10 };
      mockInventoryService.createItem.mockResolvedValue({
        id: 'item-1',
        ...dto,
      });

      const result = await itemsController.create(dto);

      expect(result.id).toBe('item-1');
      expect(mockInventoryService.createItem).toHaveBeenCalledWith(dto);
    });

    it('GET /admin/inventory/items/low-stock should return low stock items', async () => {
      mockInventoryService.getLowStockItems.mockResolvedValue([
        { id: 'item-1' },
      ]);

      const result = await itemsController.getLowStock();

      expect(result).toHaveLength(1);
      expect(mockInventoryService.getLowStockItems).toHaveBeenCalled();
    });

    it('GET /admin/inventory/items should list items', async () => {
      mockInventoryService.findAllItems.mockResolvedValue({
        data: [{ id: 'item-1' }],
        meta: { total: 1 },
      });

      const result = await itemsController.findAll({ search: 'Ihram' });

      expect(result.data).toHaveLength(1);
      expect(mockInventoryService.findAllItems).toHaveBeenCalledWith({
        search: 'Ihram',
      });
    });

    it('GET /admin/inventory/items/:id should return single item', async () => {
      mockInventoryService.findOneItem.mockResolvedValue({ id: 'item-1' });

      const result = await itemsController.findOne('item-1');

      expect(result.id).toBe('item-1');
    });

    it('PATCH /admin/inventory/items/:id should update item', async () => {
      mockInventoryService.updateItem.mockResolvedValue({
        id: 'item-1',
        name: 'Updated Name',
      });

      const result = await itemsController.update('item-1', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('DELETE /admin/inventory/items/:id should remove item', async () => {
      mockInventoryService.removeItem.mockResolvedValue(undefined);

      await itemsController.remove('item-1');

      expect(mockInventoryService.removeItem).toHaveBeenCalledWith('item-1');
    });
  });

  describe('InventoryTransactionsController', () => {
    it('POST /admin/inventory/transactions should record stock transaction', async () => {
      const dto = {
        inventory_item_id: 'item-1',
        type: InventoryTransactionType.ISSUE,
        quantity: 2,
      };
      mockInventoryService.createTransaction.mockResolvedValue({
        id: 'tx-1',
        ...dto,
      });

      const result = await txController.create('admin-1', dto);

      expect(result.id).toBe('tx-1');
      expect(mockInventoryService.createTransaction).toHaveBeenCalledWith(
        'admin-1',
        dto,
      );
    });

    it('GET /admin/inventory/transactions should list transactions', async () => {
      mockInventoryService.findAllTransactions.mockResolvedValue({
        data: [{ id: 'tx-1' }],
        meta: { total: 1 },
      });

      const result = await txController.findAll({
        inventory_item_id: 'item-1',
      });

      expect(result.data).toHaveLength(1);
      expect(mockInventoryService.findAllTransactions).toHaveBeenCalledWith({
        inventory_item_id: 'item-1',
      });
    });
  });
});
