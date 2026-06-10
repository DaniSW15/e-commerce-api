import {
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SearchSortBy {
  RELEVANCE = 'relevance',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NEWEST = 'newest',
  NAME = 'name',
}

export class SearchProductDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsEnum(SearchSortBy)
  sortBy?: SearchSortBy = SearchSortBy.RELEVANCE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
