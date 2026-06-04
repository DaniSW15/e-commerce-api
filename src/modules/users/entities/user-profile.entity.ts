import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";

@Entity('user_profiles')
export class UserProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ nullable: true })
    firstName: string;

    @Column({ nullable: true })
    lastName: string;

    @Column({ nullable: true })
    phone: string;

    @Column({ nullable: true, type: 'date' })
    dateOfBirth: Date;

    @Column({ nullable: true })
    avatarUrl: string;

    @Column({ type: 'jsonb', default: {} })
    preferences: Record<string, any>;

    @OneToOne(() => User, user => user.profile)
    @JoinColumn({ name: 'userId' })
    user: User;
}