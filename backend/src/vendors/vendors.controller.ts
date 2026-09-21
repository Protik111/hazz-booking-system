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
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ListVendorsQueryDto } from './dto/list-vendors-query.dto';
import { CreateVendorExpenseDto } from './dto/create-vendor-expense.dto';
import { UpdateVendorExpenseDto } from './dto/update-vendor-expense.dto';
import { ListVendorExpensesQueryDto } from './dto/list-vendor-expenses-query.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../user/enums/user-role.enum';

// ─── Admin Vendors Controller: /api/v1/admin/vendors ─────────────────────────

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createVendorDto: CreateVendorDto) {
    return this.vendorsService.createVendor(createVendorDto);
  }

  @Get()
  findAll(@Query() query: ListVendorsQueryDto) {
    return this.vendorsService.findAllVendors(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.findOneVendor(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVendorDto: UpdateVendorDto,
  ) {
    return this.vendorsService.updateVendor(id, updateVendorDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.removeVendor(id);
  }
}

// ─── Admin Vendor Expenses Controller: /api/v1/admin/vendor-expenses ──────────

@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/vendor-expenses')
export class VendorExpensesController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('userId') adminId: string,
    @Body() createExpenseDto: CreateVendorExpenseDto,
  ) {
    return this.vendorsService.createExpense(adminId, createExpenseDto);
  }

  @Get('summary')
  getSummary() {
    return this.vendorsService.getExpenseSummary();
  }

  @Get()
  findAll(@Query() query: ListVendorExpensesQueryDto) {
    return this.vendorsService.findAllExpenses(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.findOneExpense(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExpenseDto: UpdateVendorExpenseDto,
  ) {
    return this.vendorsService.updateExpense(id, updateExpenseDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.removeExpense(id);
  }
}
