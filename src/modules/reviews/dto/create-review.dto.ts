import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 5, description: 'Rating from 1 to 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    example: 'Excellent product, highly recommended!',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(5, 500)
  comment?: string;
}
