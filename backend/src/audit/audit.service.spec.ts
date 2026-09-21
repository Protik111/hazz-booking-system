import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;

  const mockAuditRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditRepo,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('recordLog', () => {
    it('should create and save an audit log entry', async () => {
      const dto = {
        actor_id: 'user-1',
        action: 'BOOKING_CREATED',
        entity_type: 'Booking',
        entity_id: 'b-1',
        new_value: { status: 'PENDING' },
        ip_address: '127.0.0.1',
      };
      const created = { id: 'log-1', ...dto };
      mockAuditRepo.create.mockReturnValue(created);
      mockAuditRepo.save.mockResolvedValue(created);

      const result = await service.recordLog(dto);

      expect(result.id).toBe('log-1');
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'user-1',
          action: 'BOOKING_CREATED',
          entity_type: 'Booking',
          entity_id: 'b-1',
        }),
      );
      expect(mockAuditRepo.save).toHaveBeenCalledWith(created);
    });
  });

  describe('handleAuditLogEvent', () => {
    it('should catch errors gracefully without throwing', async () => {
      mockAuditRepo.save.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.handleAuditLogEvent({
          action: 'TEST',
          entity_type: 'Test',
          entity_id: 't-1',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('findAll', () => {
    it('should query logs with filters and pagination', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'log-1' }], 1]),
      };
      mockAuditRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({
        actor_id: 'user-1',
        action: 'CREATED',
        entity_type: 'Booking',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(qb.andWhere).toHaveBeenCalledTimes(3);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if log not found', async () => {
      mockAuditRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('log-99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return log if found', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ id: 'log-1' });

      const result = await service.findOne('log-1');

      expect(result.id).toBe('log-1');
    });
  });
});
