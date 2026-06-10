import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { ProductsModule } from '@modules/products/products.module';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    ProductsModule,
    AuthModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
