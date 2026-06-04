import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class EnableTwoFactorDto {
    @ApiProperty()
    @IsString()
    code: string;
}

export class VerifyTwoFactorDto {
    @ApiProperty()
    @IsString()
    code: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    deviceInfo?: string;
}

export class DisableTwoFactorDto {
    @ApiProperty()
    @IsString()
    code: string;
}