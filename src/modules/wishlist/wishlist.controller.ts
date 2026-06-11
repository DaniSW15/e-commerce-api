import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators';

@ApiTags('wishlist')
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: "Get current user's wishlist" })
  @ApiResponse({ status: 200, description: 'Wishlist retrieved successfully.' })
  async getWishlist(@CurrentUser('id') userId: string) {
    return this.wishlistService.getOrCreateWishlist(userId);
  }

  @Post('products/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add product to wishlist' })
  @ApiResponse({ status: 200, description: 'Product added to wishlist.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async addProduct(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.addProduct(userId, productId);
  }

  @Delete('products/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove product from wishlist' })
  @ApiResponse({ status: 200, description: 'Product removed from wishlist.' })
  async removeProduct(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.removeProduct(userId, productId);
  }
}
