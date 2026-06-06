import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Notification, NotificationStatus } from '../entities/notification.entity';

@Processor('email')
export class EmailProcessor {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {
    // Configurar SMTP (Mailtrap para dev, SendGrid para prod)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'live.smtp.mailtrap.io',
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: {
        user: process.env.SMTP_USER || 'api',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }

  @Process('send')
  async handleSend(job: Job) {
    const { notificationId, to, subject, html, text } = job.data;

    try {
      // Enviar email
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@example.com',
        to,
        subject,
        html,
        text,
      });

      // Actualizar a SENT
      await this.notificationRepository.update(notificationId, {
        status: NotificationStatus.SENT,
      });

      console.log(`✅ Email sent to ${to}`);
    } catch (error: any) {
      // Actualizar a FAILED
      await this.notificationRepository.update(notificationId, {
        status: NotificationStatus.FAILED,
        errorMessage: error.message,
      });

      console.error(`❌ Email failed: ${error.message}`);
      throw error; // Bull reintentará
    }
  }
}