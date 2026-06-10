import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsObject,
  IsString,
  IsNumber,
  IsUUID,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  attributes?: Record<string, any>;
}

class AddressDto {
  @ApiProperty()
  @IsString()
  street: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  state: string;

  @ApiProperty()
  @IsString()
  postalCode: string;

  @ApiProperty()
  @IsString()
  country: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @ApiProperty()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress: AddressDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
