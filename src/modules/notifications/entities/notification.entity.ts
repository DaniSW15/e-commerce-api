import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  recipient: string; // email o phone

  @Column()
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
