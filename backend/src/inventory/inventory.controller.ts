import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { ListInventoryTransactionsQueryDto } from './dto/list-inventory-transactions-query.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../user/enums/user-role.enum';

// ─── Admin Inventory Items Controller: /api/v1/admin/inventory/items ─────────

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/inventory/items')
export class InventoryItemsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createItemDto: CreateInventoryItemDto) {
    return this.inventoryService.createItem(createItemDto);
  }

  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStockItems();
  }

  @Get()
  findAll(@Query() query: ListInventoryItemsQueryDto) {
    return this.inventoryService.findAllItems(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOneItem(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateItemDto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(id, updateItemDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.removeItem(id);
  }
}

// ─── Admin Inventory Transactions: /api/v1/admin/inventory/transactions ──────

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/inventory/transactions')
export class InventoryTransactionsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('userId') userId: string,
    @Body() createTxDto: CreateInventoryTransactionDto,
  ) {
    return this.inventoryService.createTransaction(userId, createTxDto);
  }

  @Get()
  findAll(@Query() query: ListInventoryTransactionsQueryDto) {
    return this.inventoryService.findAllTransactions(query);
  }
}
