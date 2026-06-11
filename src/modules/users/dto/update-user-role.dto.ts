import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '@/common/enums';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, example: 'admin' })
  @IsEnum(UserRole)
  role: UserRole;
}
