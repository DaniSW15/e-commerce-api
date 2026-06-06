import { InjectQueue } from '@nestjs/bull';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { SendEmailDto } from './dto/send-email.dto';
import { NotificationStatus, NotificationType } from './entities/notification.entity';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) { }

  async sendEmail(dto: SendEmailDto): Promise<{ message: string; jobId: number | string }> {
    /// 1. Crear notificación con create() en vez de save() directo
    const notification = this.notificationRepository.create({
      type: NotificationType.EMAIL,
      recipient: dto.to,
      subject: dto.subject,
      content: dto.html,
      status: NotificationStatus.PENDING,
      metadata: dto.metadata || {},
    });

    // 2. Guardar en DB
    const saved = await this.notificationRepository.save(notification);

    // 3. Agregar a cola
    const job = await this.emailQueue.add('send', {
      notificationId: saved.id,
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
      jobId: job.id
    };
  }

  async getStatus(notificationId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }
}
