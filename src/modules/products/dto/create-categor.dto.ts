import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsBoolean, IsNumber } from 'class-validator';

export class CreateCategoryDto {
    @ApiProperty({ example: 'Electronics' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'electronics' })
    @IsString()
    slug: string;

    @ApiProperty({ required: false, example: 'Electronic devices and gadgets' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    imageUrl?: string;

    @ApiProperty({ required: false, example: 'uuid-parent-category' })
    @IsOptional()
    @IsUUID()
    parentId?: string;

    @ApiProperty({ required: false, example: 0 })
    @IsOptional()
    @IsNumber()
    sortOrder?: number;

    @ApiProperty({ required: false, example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}