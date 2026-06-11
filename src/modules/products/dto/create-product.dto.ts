import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import { ProductStatus } from '../entities/product.entity';

export class CreateProductDto {
  @ApiProperty({ example: 'SKU-12345' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 'Nike Air Max' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'nike-air-max' })
  @IsString()
  slug: string;

  @ApiProperty({ required: false, example: 'Amazing running shoes...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 99.99 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ required: false, example: 129.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  comparePrice?: number;

  @ApiProperty({ required: false, example: 50.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  stockQuantity: number;

  @ApiProperty({ required: false, example: 1.5 })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiProperty({ enum: ProductStatus, example: 'active' })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiProperty({ required: false, example: { color: 'red', size: 'XL' } })
  @IsOptional()
  attributes?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: { title: 'Nike Air Max', description: 'Best shoes' },
  })
  @IsOptional()
  seoMeta?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };

  @ApiProperty({ required: false, example: 'uuid-category' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['https://cdn.com/img1.jpg'],
  })
  @IsOptional()
  imageUrls?: string[];
}
