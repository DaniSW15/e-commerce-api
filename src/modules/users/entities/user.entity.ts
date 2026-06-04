import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    OneToOne,
    OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserProfile } from './user-profile.entity';
import { UserAddress } from './user-address.entity';
import { LoginAttempt } from './login-attempt.entity';
import { RefreshToken } from '../../auth/entites/refresh-token.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Exclude()
    @Column()
    password: string;

    @Column({ type: 'varchar', default: 'customer' })
    role: string;

    @Column({ default: 'active' })
    status: string;

    @Column({ default: false })
    emailVerified: boolean;

    @Column({ default: false })
    twoFactorEnabled: boolean;

    @Column({ nullable: true })
    twoFactorSecret: string | null;  // ← Campo faltante

    @Column({ nullable: true })
    lastLoginAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date | null;

    // Relaciones
    @OneToOne(() => UserProfile, profile => profile.user)
    profile: UserProfile;

    @OneToMany(() => UserAddress, address => address.user)
    addresses: UserAddress[];

    @OneToMany(() => LoginAttempt, attempt => attempt.user)
    loginAttempts: LoginAttempt[];

    @OneToMany(() => RefreshToken, refreshToken => refreshToken.user)
    refreshTokens: RefreshToken[];
}