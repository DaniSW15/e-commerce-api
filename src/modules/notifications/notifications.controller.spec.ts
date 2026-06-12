import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SendEmailDto } from './dto/send-email.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const mockNotificationsService = {
      sendEmail: jest.fn(),
      getStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get(NotificationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should call service.sendEmail with dto', async () => {
      const dto: SendEmailDto = {
        to: 'test@example.com',
        subject: 'Welcome',
        html: '<p>Welcome</p>',
      };

      service.sendEmail.mockResolvedValueOnce({
        message: 'Email queued successfully',
        jobId: '1',
      });

      const result = await controller.sendEmail(dto);

      expect(service.sendEmail).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'Email queued successfully',
        jobId: '1',
      });
    });
  });

  describe('getStatus', () => {
    it('should call service.getStatus with id', async () => {
      const mockStatus = { id: 'notif-id', status: 'PENDING' };
      service.getStatus.mockResolvedValueOnce(mockStatus as any);

      const result = await controller.getStatus('notif-id');

      expect(service.getStatus).toHaveBeenCalledWith('notif-id');
      expect(result).toEqual(mockStatus);
    });
  });
});
