import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.orderItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column()
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  productPrice: number;

  @Column()
  quantity: number;

  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, any>; // color, size, etc.

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;
}
