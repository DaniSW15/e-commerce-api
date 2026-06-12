import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessor } from './email.processor';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Notification,
  NotificationStatus,
} from '../entities/notification.entity';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => {
  const mSendMail = jest.fn();
  return {
    createTransport: jest.fn().mockReturnValue({
      sendMail: mSendMail,
    }),
    _mockSendMail: mSendMail,
  };
});

const mockSendMail = (nodemailer as any)._mockSendMail;

const mockRepository = () => ({
  update: jest.fn(),
});

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let notificationRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    mockSendMail.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository(),
        },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
    notificationRepo = module.get(getRepositoryToken(Notification));
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleSend', () => {
    const mockJob = {
      data: {
        notificationId: 'notif-uuid',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>test</p>',
        text: 'test',
      },
    } as Job;

    it('should successfully send email and update status to SENT', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: '123' });
      notificationRepo.update.mockResolvedValueOnce(undefined);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await processor.handleSend(mockJob);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>test</p>',
        text: 'test',
      });
      expect(notificationRepo.update).toHaveBeenCalledWith('notif-uuid', {
        status: NotificationStatus.SENT,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '✅ Email sent to test@example.com',
      );
      consoleLogSpy.mockRestore();
    });

    it('should update status to FAILED and log error when sendMail fails', async () => {
      const error = new Error('SMTP Error');
      mockSendMail.mockRejectedValueOnce(error);
      notificationRepo.update.mockResolvedValueOnce(undefined);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(processor.handleSend(mockJob)).rejects.toThrow('SMTP Error');

      expect(notificationRepo.update).toHaveBeenCalledWith('notif-uuid', {
        status: NotificationStatus.FAILED,
        errorMessage: 'SMTP Error',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Email failed: SMTP Error',
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
