import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';
import { SendEmailDto } from './dto/send-email.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) { }

  async sendEmail(dto: SendEmailDto): Promise<{ message: string; jobId: number | string }> {
    // 1. Guardar en DB
    const notification = await this.notificationRepository.save({
      type: NotificationType.EMAIL,
      recipient: dto.to,
      subject: dto.subject,
      content: dto.html,
      status: NotificationStatus.PENDING,
      metadata: dto.metadata || {},
    });

    // 2. Agregar a cola
    const job = await this.emailQueue.add('send', {
      notificationId: notification.id,
      to: dto.to,
      subject: dto.subject,
      html: dto.html,
      text: dto.text,
    }, {
      delay: 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    return {
      message: 'Email queued successfully',
      jobId: job.id,
    };
  }

  async getStatus(notificationId: string): Promise<Notification> {
    return this.notificationRepository.findOne({
    where: { id: notificationId },
  });
  }
}