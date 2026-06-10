import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum MediaType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  VIDEO = 'video',
}

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalName: string;

  @Column()
  fileName: string;

  @Column()
  mimeType: string;

  @Column()
  url: string;

  @Column({ type: 'enum', enum: MediaType, default: MediaType.IMAGE })
  type: MediaType;

  @Column({ nullable: true })
  size: number;

  @Column({ nullable: true })
  width: number;

  @Column({ nullable: true })
  height: number;

  @Column({ nullable: true })
  altText: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string;

  @CreateDateColumn()
  createdAt: Date;
}
