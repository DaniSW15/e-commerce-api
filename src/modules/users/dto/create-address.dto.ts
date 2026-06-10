import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  Length,
} from 'class-validator';
import { AddressType } from '../entities/user-address.entity';

export class CreateAddressDto {
  @ApiProperty({ enum: AddressType, example: 'shipping' })
  @IsEnum(AddressType)
  type: AddressType;

  @ApiProperty({ required: false, example: 'Casa' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  label?: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @Length(1, 255)
  street: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  @Length(1, 100)
  city: string;

  @ApiProperty({ required: false, example: 'NY' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '10001' })
  @IsString()
  @Length(1, 20)
  postalCode: string;

  @ApiProperty({ example: 'US', minLength: 2, maxLength: 2 })
  @IsString()
  @Length(2, 2)
  country: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
