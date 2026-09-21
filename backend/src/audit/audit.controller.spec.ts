import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;

  const mockAuditService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  it('GET /admin/audit-logs should return list of logs', async () => {
    mockAuditService.findAll.mockResolvedValue({
      data: [{ id: 'log-1' }],
      meta: { total: 1 },
    });

    const result = await controller.findAll({ action: 'CREATED' });

    expect(result.data).toHaveLength(1);
    expect(mockAuditService.findAll).toHaveBeenCalledWith({
      action: 'CREATED',
    });
  });

  it('GET /admin/audit-logs/:id should return single log', async () => {
    mockAuditService.findOne.mockResolvedValue({ id: 'log-1' });

    const result = await controller.findOne('log-1');

    expect(result.id).toBe('log-1');
    expect(mockAuditService.findOne).toHaveBeenCalledWith('log-1');
  });
});
