import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, Length } from 'class-validator';

export class UpdateProfileDto {
    @ApiProperty({ required: false, example: 'John' })
    @IsOptional()
    @IsString()
    @Length(1, 100)
    firstName?: string;

    @ApiProperty({ required: false, example: 'Doe' })
    @IsOptional()
    @IsString()
    @Length(1, 100)
    lastName?: string;

    @ApiProperty({ required: false, example: '+1234567890' })
    @IsOptional()
    @IsString()
    @Length(5, 20)
    phone?: string;

    @ApiProperty({ required: false, example: '1990-01-01' })
    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @ApiProperty({ required: false, example: 'https://cdn.example.com/avatar.jpg' })
    @IsOptional()
    @IsString()
    avatarUrl?: string;

    @ApiProperty({ required: false, example: { language: 'es', currency: 'USD' } })
    @IsOptional()
    preferences?: {
        language?: string;
        currency?: string;
        notifications?: boolean;
    };
}