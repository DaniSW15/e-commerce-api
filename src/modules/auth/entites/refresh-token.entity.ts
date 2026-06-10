import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
@Index(['userId', 'revokedAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  tokenHash: string;

  @Column({ nullable: true })
  deviceInfo: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  revokedAt: Date;

  @Column({ nullable: true })
  revokedReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.refreshTokens)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Helper methods
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }
}
