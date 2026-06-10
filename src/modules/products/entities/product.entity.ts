import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { ProductImage } from './product-image.entity';

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  comparePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost: number;

  @Column({ default: 0 })
  stockQuantity: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  weight: number;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  status: ProductStatus;

  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, any>; // color, size, etc.

  @Column({ type: 'jsonb', default: {} })
  seoMeta: {
    title?: string;
    description?: string;
    keywords?: string[];
  };

  @ManyToOne(() => Category, (category) => category.id, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ nullable: true })
  categoryId: string;

  @OneToMany(() => ProductImage, (image) => image.product, { cascade: true })
  images: ProductImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
