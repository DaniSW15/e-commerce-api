import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators';
import { UserRole } from '@/common/enums';

@ApiTags('Product Reviews')
@Controller('products')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a review for a product (Requires purchase)' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({
    status: 403,
    description: 'User has not purchased this product',
  })
  @ApiResponse({
    status: 409,
    description: 'User already reviewed this product',
  })
  async createReview(
    @Param('id') productId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(userId, productId, dto);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Get paginated reviews for a product' })
  @ApiResponse({ status: 200, description: 'List of reviews' })
  async getReviews(
    @Param('id') productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.reviewsService.findByProduct(productId, page, limit);
  }

  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a product review (Author or Admin only)' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Unauthorized to delete this review',
  })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async deleteReview(
    @Param('id') reviewId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.reviewsService.delete(reviewId, userId, role);
  }
}
