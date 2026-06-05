// dto/login-2fa.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Length, Matches } from "class-validator";

export class Login2FADto {
    @ApiProperty({
        example: 'eyJhbGciOiJIUzI1NiIs...',
        description: 'Temp token from first login step'
    })
    @IsString()
    tempToken: string;

    @ApiProperty({
        example: '123456',
        description: '6-digit 2FA code from authenticator app'
    })
    @IsString()
    @Length(6, 6)
    @Matches(/^\d{6}$/, { message: '2FA code must be 6 digits' })
    twoFactorCode: string;

    @ApiProperty({
        required: false,
        example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        description: 'Device information for session tracking'
    })
    @IsOptional()
    @IsString()
    deviceInfo?: string;
}