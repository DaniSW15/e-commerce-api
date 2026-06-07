import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { getQueueToken } from '@nestjs/bull';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
});

const mockQueue = () => ({
  add: jest.fn(),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: ReturnType<typeof mockRepository>;
  let emailQueue: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: mockRepository() },
        { provide: getQueueToken('email'), useValue: mockQueue() },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationRepo = module.get(getRepositoryToken(Notification));
    emailQueue = module.get(getQueueToken('email'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should queue email', async () => {
      const dto = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<h1>Hello</h1>',
      };

      notificationRepo.save.mockResolvedValue({ id: 'notif-uuid' });
      emailQueue.add.mockResolvedValue({ id: 1 });

      const result = await service.sendEmail(dto);

      expect(result).toHaveProperty('message', 'Email queued successfully');
      expect(result).toHaveProperty('jobId');
      expect(emailQueue.add).toHaveBeenCalled();
    });
  });
});