import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingsController,
  InstallmentsController,
  AdminBookingsController,
} from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PaymentPlan } from './enums/payment-plan.enum';
import { UserRole } from '../user/enums/user-role.enum';
import { PilgrimGender } from './enums/pilgrim-status.enum';

describe('BookingsController, InstallmentsController, AdminBookingsController', () => {
  let bookingsController: BookingsController;
  let installmentsController: InstallmentsController;
  let adminBookingsController: AdminBookingsController;

  const mockBookingsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    addPilgrim: jest.fn(),
    listPilgrims: jest.fn(),
    updatePilgrim: jest.fn(),
    cancelPilgrim: jest.fn(),
    getInstallments: jest.fn(),
    getInstallmentById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        BookingsController,
        InstallmentsController,
        AdminBookingsController,
      ],
      providers: [
        {
          provide: BookingsService,
          useValue: mockBookingsService,
        },
      ],
    }).compile();

    bookingsController = module.get<BookingsController>(BookingsController);
    installmentsController = module.get<InstallmentsController>(
      InstallmentsController,
    );
    adminBookingsController = module.get<AdminBookingsController>(
      AdminBookingsController,
    );
  });

  it('should be defined', () => {
    expect(bookingsController).toBeDefined();
    expect(installmentsController).toBeDefined();
    expect(adminBookingsController).toBeDefined();
  });

  describe('BookingsController', () => {
    it('POST /bookings should create booking', async () => {
      const dto = {
        package_tier_id: 'tier-1',
        payment_plan: PaymentPlan.FULL_PAYMENT,
        pilgrim_count: 1,
      };
      mockBookingsService.create.mockResolvedValue({ id: 'b-1' });

      const result = await bookingsController.create('user-1', dto);

      expect(result.id).toBe('b-1');
      expect(mockBookingsService.create).toHaveBeenCalledWith('user-1', dto);
    });

    it('GET /bookings should list bookings', async () => {
      mockBookingsService.findAll.mockResolvedValue({ data: [], meta: {} });

      await bookingsController.findAll('user-1', UserRole.USER, {
        page: 1,
        limit: 10,
      });

      expect(mockBookingsService.findAll).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        { page: 1, limit: 10 },
      );
    });

    it('POST /bookings/:id/cancel should cancel booking', async () => {
      mockBookingsService.cancel.mockResolvedValue({ status: 'CANCELLED' });

      const result = await bookingsController.cancel(
        'user-1',
        UserRole.USER,
        'b-1',
      );

      expect(result.status).toBe('CANCELLED');
      expect(mockBookingsService.cancel).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'b-1',
      );
    });

    it('POST /bookings/:id/pilgrims should add pilgrim', async () => {
      const dto = {
        full_name: 'Test Pilgrim',
        date_of_birth: '1990-01-01',
        gender: PilgrimGender.MALE,
        passport_number: 'A12345678',
      };
      mockBookingsService.addPilgrim.mockResolvedValue({ id: 'p-1', ...dto });

      const result = await bookingsController.addPilgrim(
        'user-1',
        UserRole.USER,
        'b-1',
        dto,
      );

      expect(result.id).toBe('p-1');
      expect(mockBookingsService.addPilgrim).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'b-1',
        dto,
      );
    });
  });

  describe('InstallmentsController', () => {
    it('GET /installments/:id should return installment', async () => {
      mockBookingsService.getInstallmentById.mockResolvedValue({
        id: 'inst-1',
      });

      const result = await installmentsController.getInstallmentById(
        'user-1',
        UserRole.USER,
        'inst-1',
      );

      expect(result.id).toBe('inst-1');
      expect(mockBookingsService.getInstallmentById).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'inst-1',
      );
    });
  });

  describe('AdminBookingsController', () => {
    it('GET /admin/bookings should list all bookings', async () => {
      mockBookingsService.findAll.mockResolvedValue({ data: [], meta: {} });

      await adminBookingsController.listAllBookings('admin-1', UserRole.ADMIN, {
        page: 1,
        limit: 20,
      });

      expect(mockBookingsService.findAll).toHaveBeenCalledWith(
        'admin-1',
        UserRole.ADMIN,
        { page: 1, limit: 20 },
      );
    });
  });
});
