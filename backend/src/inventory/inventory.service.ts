import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Pilgrim } from '../pilgrims/entities/pilgrim.entity';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { ListInventoryTransactionsQueryDto } from './dto/list-inventory-transactions-query.dto';
import { InventoryTransactionType } from './enums/inventory-transaction-type.enum';

@Injectable()
export class InventoryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly txRepo: Repository<InventoryTransaction>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Pilgrim)
    private readonly pilgrimRepo: Repository<Pilgrim>,
  ) {}

  // ─── Inventory Items ──────────────────────────────────────────────────────

  async createItem(dto: CreateInventoryItemDto): Promise<InventoryItem> {
    const existing = await this.itemRepo.findOne({
      where: { sku: dto.sku },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        `Inventory item with SKU '${dto.sku}' already exists`,
      );
    }

    const item = this.itemRepo.create(dto);
    return this.itemRepo.save(item);
  }

  async findAllItems(query: ListInventoryItemsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.itemRepo.createQueryBuilder('item');

    if (query.search) {
      qb.andWhere('(item.name ILIKE :search OR item.sku ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }

    if (query.low_stock) {
      qb.andWhere('item.quantity <= item.minimum_stock');
    }

    qb.orderBy('item.created_at', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneItem(id: string): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({
      where: { id },
      relations: ['transactions'],
    });

    if (!item) {
      throw new NotFoundException(`Inventory item with ID '${id}' not found`);
    }

    return item;
  }

  async updateItem(
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItem> {
    const item = await this.findOneItem(id);

    if (dto.sku && dto.sku !== item.sku) {
      const existing = await this.itemRepo.findOne({
        where: { sku: dto.sku },
      });
      if (existing) {
        throw new ConflictException(
          `Inventory item with SKU '${dto.sku}' already exists`,
        );
      }
    }

    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async removeItem(id: string): Promise<void> {
    const item = await this.findOneItem(id);
    await this.itemRepo.softRemove(item);
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .where('item.quantity <= item.minimum_stock')
      .orderBy('item.quantity', 'ASC')
      .getMany();
  }

  // ─── Inventory Transactions ───────────────────────────────────────────────

  async createTransaction(
    userId: string,
    dto: CreateInventoryTransactionDto,
  ): Promise<InventoryTransaction> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Lock item with pessimistic write lock (FOR UPDATE)
      const item = await manager.findOne(InventoryItem, {
        where: { id: dto.inventory_item_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!item) {
        throw new NotFoundException(
          `Inventory item with ID '${dto.inventory_item_id}' not found`,
        );
      }

      // 2. Validate optional relations
      if (dto.booking_id) {
        const booking = await manager.findOne(Booking, {
          where: { id: dto.booking_id },
        });
        if (!booking) {
          throw new NotFoundException(
            `Booking with ID '${dto.booking_id}' not found`,
          );
        }
      }

      if (dto.pilgrim_id) {
        const pilgrim = await manager.findOne(Pilgrim, {
          where: { id: dto.pilgrim_id },
        });
        if (!pilgrim) {
          throw new NotFoundException(
            `Pilgrim with ID '${dto.pilgrim_id}' not found`,
          );
        }
      }

      // 3. Compute and validate new stock
      let newStock = item.quantity;

      switch (dto.type) {
        case InventoryTransactionType.PURCHASE:
        case InventoryTransactionType.RETURN:
          if (dto.quantity <= 0) {
            throw new BadRequestException(
              `Quantity for ${dto.type} must be greater than 0`,
            );
          }
          newStock = item.quantity + dto.quantity;
          break;

        case InventoryTransactionType.ISSUE:
          if (dto.quantity <= 0) {
            throw new BadRequestException(
              'Quantity for ISSUE must be greater than 0',
            );
          }
          if (dto.quantity > item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for item '${item.name}'. Available: ${item.quantity}, Requested: ${dto.quantity}`,
            );
          }
          newStock = item.quantity - dto.quantity;
          break;

        case InventoryTransactionType.ADJUSTMENT:
          newStock = item.quantity + dto.quantity;
          if (newStock < 0) {
            throw new BadRequestException(
              `Stock adjustment cannot result in negative stock. Current: ${item.quantity}, Adjustment: ${dto.quantity}`,
            );
          }
          break;
      }

      // 4. Update item stock
      item.quantity = newStock;
      await manager.save(InventoryItem, item);

      // 5. Create and save transaction log
      const tx = manager.create(InventoryTransaction, {
        inventory_item_id: dto.inventory_item_id,
        type: dto.type,
        quantity: dto.quantity,
        booking_id: dto.booking_id ?? null,
        pilgrim_id: dto.pilgrim_id ?? null,
        created_by_id: userId,
        notes: dto.notes ?? null,
      });

      return manager.save(InventoryTransaction, tx);
    });
  }

  async findAllTransactions(query: ListInventoryTransactionsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.inventory_item', 'item')
      .leftJoinAndSelect('tx.booking', 'b')
      .leftJoinAndSelect('tx.pilgrim', 'p')
      .leftJoinAndSelect('tx.created_by', 'u');

    if (query.inventory_item_id) {
      qb.andWhere('tx.inventory_item_id = :itemId', {
        itemId: query.inventory_item_id,
      });
    }

    if (query.type) {
      qb.andWhere('tx.type = :type', { type: query.type });
    }

    if (query.booking_id) {
      qb.andWhere('tx.booking_id = :bookingId', {
        bookingId: query.booking_id,
      });
    }

    if (query.pilgrim_id) {
      qb.andWhere('tx.pilgrim_id = :pilgrimId', {
        pilgrimId: query.pilgrim_id,
      });
    }

    if (query.date_from) {
      qb.andWhere('tx.created_at >= :dateFrom', {
        dateFrom: new Date(query.date_from),
      });
    }

    if (query.date_to) {
      qb.andWhere('tx.created_at <= :dateTo', {
        dateTo: new Date(query.date_to),
      });
    }

    qb.orderBy('tx.created_at', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
