import { IsUUID, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ description: 'Product ID', example: 'uuid-product' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Quantity', example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
