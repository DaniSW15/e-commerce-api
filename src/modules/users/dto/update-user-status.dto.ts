import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus, example: 'suspended' })
  @IsEnum(UserStatus)
  status: UserStatus;
}
