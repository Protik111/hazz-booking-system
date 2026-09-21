import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './entities/vendor.entity';
import { VendorExpense } from './entities/vendor-expense.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Package } from '../packages/entities/package.entity';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ListVendorsQueryDto } from './dto/list-vendors-query.dto';
import { CreateVendorExpenseDto } from './dto/create-vendor-expense.dto';
import { UpdateVendorExpenseDto } from './dto/update-vendor-expense.dto';
import { ListVendorExpensesQueryDto } from './dto/list-vendor-expenses-query.dto';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(VendorExpense)
    private readonly expenseRepo: Repository<VendorExpense>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Package)
    private readonly packageRepo: Repository<Package>,
  ) {}

  // ─── Vendor Management ──────────────────────────────────────────────────

  async createVendor(dto: CreateVendorDto): Promise<Vendor> {
    const vendor = this.vendorRepo.create(dto);
    return this.vendorRepo.save(vendor);
  }

  async findAllVendors(query: ListVendorsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.vendorRepo.createQueryBuilder('v');

    if (query.search) {
      qb.andWhere(
        '(v.name ILIKE :search OR v.contact_name ILIKE :search OR v.contact_email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.type) {
      qb.andWhere('v.type = :type', { type: query.type });
    }

    if (query.status) {
      qb.andWhere('v.status = :status', { status: query.status });
    }

    qb.orderBy('v.created_at', 'DESC').skip(skip).take(limit);

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

  async findOneVendor(id: string): Promise<Vendor> {
    const vendor = await this.vendorRepo.findOne({
      where: { id },
      relations: ['expenses'],
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID '${id}' not found`);
    }

    return vendor;
  }

  async updateVendor(id: string, dto: UpdateVendorDto): Promise<Vendor> {
    const vendor = await this.findOneVendor(id);
    Object.assign(vendor, dto);
    return this.vendorRepo.save(vendor);
  }

  async removeVendor(id: string): Promise<void> {
    const vendor = await this.findOneVendor(id);
    await this.vendorRepo.softRemove(vendor);
  }

  // ─── Vendor Expenses ────────────────────────────────────────────────────

  async createExpense(
    adminId: string,
    dto: CreateVendorExpenseDto,
  ): Promise<VendorExpense> {
    // 1. Validate vendor exists
    const vendor = await this.vendorRepo.findOne({
      where: { id: dto.vendor_id },
    });
    if (!vendor) {
      throw new NotFoundException(
        `Vendor with ID '${dto.vendor_id}' not found`,
      );
    }

    // 2. Validate booking if provided
    if (dto.booking_id) {
      const booking = await this.bookingRepo.findOne({
        where: { id: dto.booking_id },
      });
      if (!booking) {
        throw new NotFoundException(
          `Booking with ID '${dto.booking_id}' not found`,
        );
      }
    }

    // 3. Validate package if provided
    if (dto.package_id) {
      const pkg = await this.packageRepo.findOne({
        where: { id: dto.package_id },
      });
      if (!pkg) {
        throw new NotFoundException(
          `Package with ID '${dto.package_id}' not found`,
        );
      }
    }

    // 4. Calculate amount_bdt server-side: amount * exchange_rate
    const exchangeRate = dto.exchange_rate ?? 1.0;
    const amountBdt = (dto.amount * exchangeRate).toFixed(2);

    const expense = this.expenseRepo.create({
      vendor_id: dto.vendor_id,
      booking_id: dto.booking_id ?? null,
      package_id: dto.package_id ?? null,
      expense_type: dto.expense_type,
      amount: dto.amount.toFixed(2),
      currency: dto.currency ?? 'BDT',
      exchange_rate: exchangeRate.toFixed(4),
      amount_bdt: amountBdt,
      expense_date: new Date(dto.expense_date),
      status: dto.status,
      notes: dto.notes ?? null,
      created_by_id: adminId,
    });

    return this.expenseRepo.save(expense);
  }

  async findAllExpenses(query: ListVendorExpensesQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.vendor', 'v')
      .leftJoinAndSelect('e.booking', 'b')
      .leftJoinAndSelect('e.package', 'p')
      .leftJoinAndSelect('e.created_by', 'u');

    if (query.vendor_id) {
      qb.andWhere('e.vendor_id = :vendorId', { vendorId: query.vendor_id });
    }

    if (query.booking_id) {
      qb.andWhere('e.booking_id = :bookingId', {
        bookingId: query.booking_id,
      });
    }

    if (query.package_id) {
      qb.andWhere('e.package_id = :packageId', {
        packageId: query.package_id,
      });
    }

    if (query.expense_type) {
      qb.andWhere('e.expense_type = :expenseType', {
        expenseType: query.expense_type,
      });
    }

    if (query.currency) {
      qb.andWhere('e.currency = :currency', { currency: query.currency });
    }

    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }

    if (query.date_from) {
      qb.andWhere('e.expense_date >= :dateFrom', {
        dateFrom: new Date(query.date_from),
      });
    }

    if (query.date_to) {
      qb.andWhere('e.expense_date <= :dateTo', {
        dateTo: new Date(query.date_to),
      });
    }

    qb.orderBy('e.expense_date', 'DESC').skip(skip).take(limit);

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

  async findOneExpense(id: string): Promise<VendorExpense> {
    const expense = await this.expenseRepo.findOne({
      where: { id },
      relations: ['vendor', 'booking', 'package', 'created_by'],
    });

    if (!expense) {
      throw new NotFoundException(`Vendor expense with ID '${id}' not found`);
    }

    return expense;
  }

  async updateExpense(
    id: string,
    dto: UpdateVendorExpenseDto,
  ): Promise<VendorExpense> {
    const expense = await this.findOneExpense(id);

    if (dto.vendor_id && dto.vendor_id !== expense.vendor_id) {
      const vendor = await this.vendorRepo.findOne({
        where: { id: dto.vendor_id },
      });
      if (!vendor) {
        throw new NotFoundException(
          `Vendor with ID '${dto.vendor_id}' not found`,
        );
      }
      expense.vendor_id = dto.vendor_id;
    }

    if (dto.booking_id !== undefined) {
      expense.booking_id = dto.booking_id ?? null;
    }

    if (dto.package_id !== undefined) {
      expense.package_id = dto.package_id ?? null;
    }

    if (dto.expense_type) {
      expense.expense_type = dto.expense_type;
    }

    if (dto.currency) {
      expense.currency = dto.currency;
    }

    if (dto.expense_date) {
      expense.expense_date = new Date(dto.expense_date);
    }

    if (dto.status) {
      expense.status = dto.status;
    }

    if (dto.notes !== undefined) {
      expense.notes = dto.notes ?? null;
    }

    // Recompute amount_bdt if amount or exchange_rate is changed
    const newAmount =
      dto.amount !== undefined ? dto.amount : parseFloat(expense.amount);
    const newExchangeRate =
      dto.exchange_rate !== undefined
        ? dto.exchange_rate
        : parseFloat(expense.exchange_rate);

    if (dto.amount !== undefined || dto.exchange_rate !== undefined) {
      expense.amount = newAmount.toFixed(2);
      expense.exchange_rate = newExchangeRate.toFixed(4);
      expense.amount_bdt = (newAmount * newExchangeRate).toFixed(2);
    }

    return this.expenseRepo.save(expense);
  }

  async removeExpense(id: string): Promise<void> {
    const expense = await this.findOneExpense(id);
    await this.expenseRepo.remove(expense);
  }

  async getExpenseSummary() {
    const expenses = await this.expenseRepo.find({
      relations: ['vendor'],
    });

    let totalBdt = 0;
    const byCurrency: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byVendor: Record<string, { vendor_name: string; total_bdt: number }> =
      {};

    for (const exp of expenses) {
      const bdt = parseFloat(exp.amount_bdt) || 0;
      totalBdt += bdt;

      byCurrency[exp.currency] =
        (byCurrency[exp.currency] || 0) + (parseFloat(exp.amount) || 0);

      byType[exp.expense_type] = (byType[exp.expense_type] || 0) + bdt;

      const vendorName = exp.vendor ? exp.vendor.name : 'Unknown';
      if (!byVendor[exp.vendor_id]) {
        byVendor[exp.vendor_id] = { vendor_name: vendorName, total_bdt: 0 };
      }
      byVendor[exp.vendor_id].total_bdt += bdt;
    }

    return {
      total_expenses_bdt: totalBdt.toFixed(2),
      count: expenses.length,
      by_currency: byCurrency,
      by_type: byType,
      by_vendor: byVendor,
    };
  }
}
