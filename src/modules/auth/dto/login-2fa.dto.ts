// dto/login-2fa.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Length, Matches } from "class-validator";

export class Login2FADto {
    @ApiProperty({ example: 'a1b2c3d4e5f6...', description: 'Temp token from first login step' })
    @IsString()
    tempToken: string;

    @ApiProperty({ example: '123456', description: '6-digit 2FA code from authenticator app' })
    @IsString()
    @Length(6, 6)
    @Matches(/^\d{6}$/)
    twoFactorCode: string;

    @ApiProperty({ required: false, example: 'Mozilla/5.0...' })
    @IsString()
    @IsOptional()
    deviceInfo?: string;
}