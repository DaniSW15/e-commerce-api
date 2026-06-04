import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Length, Matches } from "class-validator";

export class LoginDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'User email address',
    })
    @IsEmail({}, { message: 'Must be a valid email address' })
    email: string;

    @ApiProperty({
        example: 'password123',
        description: 'User password',
        minLength: 6,
    })
    @IsString()
    @Length(6, 100, { message: 'Password must be between 6 and 100 characters' })
    password: string;

    @ApiProperty({
        example: '123456',
        description: '2FA code (6 digits). Required only if 2FA is enabled.',
        required: false,
        minLength: 6,
        maxLength: 6,
    })
    @IsOptional()
    @IsString()
    @Length(6, 6, { message: '2FA code must be exactly 6 digits' })
    @Matches(/^\d{6}$/, { message: '2FA code must contain only 6 digits' })
    twoFactorCode?: string;

    @ApiProperty({
        example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        description: 'Device information for session tracking',
        required: false,
    })
    @IsOptional()
    @IsString()
    deviceInfo?: string;
}