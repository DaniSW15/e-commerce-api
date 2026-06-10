import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsObject } from 'class-validator';

export class SendEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  to: string;

  @ApiProperty({ example: 'Welcome to our store!' })
  @IsString()
  subject: string;

  @ApiProperty({ example: '<h1>Welcome!</h1>' })
  @IsString()
  html: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({ required: false, example: { orderId: 'uuid' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
