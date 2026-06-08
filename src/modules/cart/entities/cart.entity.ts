import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { CartItem } from './cart-item.entity';

@Entity('carts')
export class Cart {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { eager: false })
    @JoinColumn({ name: 'userId' })
    user: User;

    @OneToMany(() => CartItem, (item) => item.cart, { cascade: true, eager: true })
    items: CartItem[];

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    subtotal: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    tax: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    total: number;

    @Column({ type: 'int', default: 0 })
    itemCount: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
