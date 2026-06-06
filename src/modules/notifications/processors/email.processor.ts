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
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
            port: parseInt(process.env.SMTP_PORT || '2525'),
            auth: {
                user: process.env.SMTP_USER || '',
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

            // Actualizar a SENT - usar findOne + save en vez de update
            const notification = await this.notificationRepository.findOne({
                where: { id: notificationId },
            });

            if (notification) {
                notification.status = NotificationStatus.SENT;
                await this.notificationRepository.save(notification);
            }

            console.log(`✅ Email sent to ${to}`);
        } catch (error: any) {
            // Actualizar a FAILED
            const notification = await this.notificationRepository.findOne({
                where: { id: notificationId },
            });

            if (notification) {
                notification.status = NotificationStatus.FAILED;
                notification.errorMessage = error.message;
                await this.notificationRepository.save(notification);
            }

            console.error(`❌ Email failed: ${error.message}`);
            throw error; // Bull reintentará
        }
    }

}