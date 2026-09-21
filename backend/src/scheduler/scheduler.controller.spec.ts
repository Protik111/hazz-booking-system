import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

describe('SchedulerController', () => {
  let controller: SchedulerController;

  const mockSchedulerService = {
    getStatus: jest.fn(),
    expireSeatHolds: jest.fn(),
    processOverdueInstallments: jest.fn(),
    sendInstallmentReminders: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulerController],
      providers: [
        {
          provide: SchedulerService,
          useValue: mockSchedulerService,
        },
      ],
    }).compile();

    controller = module.get<SchedulerController>(SchedulerController);
  });

  it('GET /admin/scheduler/status should return status', () => {
    mockSchedulerService.getStatus.mockReturnValue({ status: 'active' });

    const result = controller.getStatus();

    expect(result.status).toBe('active');
    expect(mockSchedulerService.getStatus).toHaveBeenCalled();
  });

  it('POST /admin/scheduler/trigger/expire-holds should trigger expiration', async () => {
    mockSchedulerService.expireSeatHolds.mockResolvedValue({ expiredCount: 2 });

    const result = await controller.triggerExpireHolds();

    expect(result.expiredCount).toBe(2);
    expect(mockSchedulerService.expireSeatHolds).toHaveBeenCalled();
  });

  it('POST /admin/scheduler/trigger/process-overdue should trigger overdue processing', async () => {
    mockSchedulerService.processOverdueInstallments.mockResolvedValue({
      overdueCount: 3,
    });

    const result = await controller.triggerProcessOverdue();

    expect(result.overdueCount).toBe(3);
    expect(mockSchedulerService.processOverdueInstallments).toHaveBeenCalled();
  });

  it('POST /admin/scheduler/trigger/send-reminders should trigger reminder dispatch', async () => {
    mockSchedulerService.sendInstallmentReminders.mockResolvedValue({
      remindersCount: 5,
    });

    const result = await controller.triggerSendReminders();

    expect(result.remindersCount).toBe(5);
    expect(mockSchedulerService.sendInstallmentReminders).toHaveBeenCalled();
  });
});
