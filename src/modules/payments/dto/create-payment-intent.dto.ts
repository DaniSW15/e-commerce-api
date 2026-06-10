import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiProperty({ example: 'uuid-order-id' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ required: false, example: 'pm_1234567890' })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}
