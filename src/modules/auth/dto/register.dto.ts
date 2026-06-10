import { UserRole } from '@/common/enums';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ enum: UserRole, example: 'customer', required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.CUSTOMER;

  @ApiProperty({ required: false, example: 'developer@company.com' })
  @IsOptional()
  @IsEmail()
  workEmail?: string;

  @ApiProperty({
    required: false,
    example: { department: 'engineering', position: 'senior' },
  })
  @IsOptional()
  metadata?: {
    department?: string;
    position?: string;
    team?: string;
  };
}
