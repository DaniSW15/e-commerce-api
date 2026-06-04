import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RefreshTokenDto {
    @ApiProperty({ example: 'refresh_token_string' })
    @IsString()
    refreshToken: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    deviceInfo?: string;
}