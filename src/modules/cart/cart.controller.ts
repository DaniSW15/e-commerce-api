import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators';
import { User } from '@modules/users/entities/user.entity';

@ApiTags('cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  @ApiResponse({ status: 200, description: 'Cart retrieved successfully' })
  async getCart(@CurrentUser() user: User) {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add product to cart' })
  @ApiResponse({ status: 201, description: 'Product added to cart' })
  async addItem(@CurrentUser() user: User, @Body() addToCartDto: AddToCartDto) {
    return this.cartService.addItem(user.id, addToCartDto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({ status: 200, description: 'Cart item updated successfully' })
  async updateItem(
    @CurrentUser() user: User,
    @Param('id') itemId: string,
    @Body() updateDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(user.id, itemId, updateDto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({ status: 200, description: 'Item removed from cart' })
  async removeItem(@CurrentUser() user: User, @Param('id') itemId: string) {
    return this.cartService.removeItem(user.id, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear all items from cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared successfully' })
  async clearCart(@CurrentUser() user: User) {
    return this.cartService.clearCart(user.id);
  }
}
