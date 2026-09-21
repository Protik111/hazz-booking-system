import { Test, TestingModule } from '@nestjs/testing';
import {
  PilgrimsController,
  AdminPilgrimsController,
} from './pilgrims.controller';
import { PilgrimsService } from './pilgrims.service';
import { UserRole } from '../user/enums/user-role.enum';
import { PilgrimStatus } from './enums/pilgrim-status.enum';

describe('PilgrimsController & AdminPilgrimsController', () => {
  let controller: PilgrimsController;
  let adminController: AdminPilgrimsController;

  const mockPilgrimsService = {
    findOne: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    adminFindAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PilgrimsController, AdminPilgrimsController],
      providers: [
        {
          provide: PilgrimsService,
          useValue: mockPilgrimsService,
        },
      ],
    }).compile();

    controller = module.get<PilgrimsController>(PilgrimsController);
    adminController = module.get<AdminPilgrimsController>(
      AdminPilgrimsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(adminController).toBeDefined();
  });

  describe('PilgrimsController', () => {
    it('GET /pilgrims/:id should return pilgrim', async () => {
      mockPilgrimsService.findOne.mockResolvedValue({ id: 'pilgrim-1' });

      const result = await controller.findOne(
        'user-1',
        UserRole.USER,
        'pilgrim-1',
      );

      expect(result.id).toBe('pilgrim-1');
      expect(mockPilgrimsService.findOne).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'pilgrim-1',
      );
    });

    it('PATCH /pilgrims/:id should update pilgrim', async () => {
      const dto = { phone: '01700000000' };
      mockPilgrimsService.update.mockResolvedValue({ id: 'pilgrim-1', ...dto });

      const result = await controller.update(
        'user-1',
        UserRole.USER,
        'pilgrim-1',
        dto,
      );

      expect(result.phone).toBe('01700000000');
      expect(mockPilgrimsService.update).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'pilgrim-1',
        dto,
      );
    });

    it('POST /pilgrims/:id/cancel should cancel pilgrim', async () => {
      mockPilgrimsService.cancel.mockResolvedValue({
        id: 'pilgrim-1',
        status: PilgrimStatus.CANCELLED,
      });

      const result = await controller.cancel(
        'user-1',
        UserRole.USER,
        'pilgrim-1',
      );

      expect(result.status).toBe(PilgrimStatus.CANCELLED);
      expect(mockPilgrimsService.cancel).toHaveBeenCalledWith(
        'user-1',
        UserRole.USER,
        'pilgrim-1',
      );
    });
  });

  describe('AdminPilgrimsController', () => {
    it('GET /admin/pilgrims should list pilgrims', async () => {
      mockPilgrimsService.adminFindAll.mockResolvedValue({
        data: [],
        meta: {},
      });

      await adminController.findAll({ page: 1, limit: 20 });

      expect(mockPilgrimsService.adminFindAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
    });
  });
});
