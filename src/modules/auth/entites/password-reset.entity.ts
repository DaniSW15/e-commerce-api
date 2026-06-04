import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('password_resets')
@Index(['email', 'usedAt'])
export class PasswordReset {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    email: string;

    @Column()
    tokenHash: string;

    @Column()
    expiresAt: Date;

    @Column({ nullable: true })
    usedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    // Helper method
    isValid(): boolean {
        return !this.usedAt && new Date() < this.expiresAt;
    }
}