import { Test, TestingModule } from '@nestjs/testing';
import { InstallmentsController } from './installments.controller';
import { InstallmentsService } from './installments.service';
import { UserRole } from '../user/enums/user-role.enum';
import { InstallmentStatus } from './enums/installment-status.enum';

describe('InstallmentsController', () => {
  let controller: InstallmentsController;

  const mockInstallmentsService = {
    findByBooking: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstallmentsController],
      providers: [
        {
          provide: InstallmentsService,
          useValue: mockInstallmentsService,
        },
      ],
    }).compile();

    controller = module.get<InstallmentsController>(InstallmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findOne', () => {
    it('should delegate to installmentsService.findOne', async () => {
      const mockInst = {
        id: 'inst-1',
        installment_number: 1,
        amount: '100000.00',
        status: InstallmentStatus.PENDING,
      };
      mockInstallmentsService.findOne.mockResolvedValue(mockInst);

      const result = await controller.findOne(
        'user-1',
        UserRole.USER,
        'inst-uuid',
      );

      expect(result).toBe(mockInst);
      expect(mockInstallmentsService.findOne).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'inst-uuid',
      );
    });
  });

  describe('findByBooking', () => {
    it('should delegate to installmentsService.findByBooking', async () => {
      const mockList = [{ id: 'inst-1' }];
      mockInstallmentsService.findByBooking.mockResolvedValue(mockList);

      const result = await controller.findByBooking(
        'user-1',
        UserRole.USER,
        'booking-uuid',
      );

      expect(result).toBe(mockList);
      expect(mockInstallmentsService.findByBooking).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'booking-uuid',
      );
    });
  });
});
