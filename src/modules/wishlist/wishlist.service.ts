import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wishlist } from './entities/wishlist.entity';
import { ProductsService } from '@modules/products/products.service';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(Wishlist)
    private readonly wishlistRepository: Repository<Wishlist>,
    private readonly productsService: ProductsService,
  ) {}

  async getOrCreateWishlist(userId: string): Promise<Wishlist> {
    let wishlist = await this.wishlistRepository.findOne({
      where: { userId },
      relations: { products: true },
    });

    if (!wishlist) {
      wishlist = this.wishlistRepository.create({
        userId,
        products: [],
      });
      wishlist = await this.wishlistRepository.save(wishlist);
    }

    return wishlist;
  }

  async addProduct(userId: string, productId: string): Promise<Wishlist> {
    const product = await this.productsService.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    const wishlist = await this.getOrCreateWishlist(userId);

    const hasProduct = wishlist.products.some((p) => p.id === productId);
    if (!hasProduct) {
      wishlist.products.push(product);
      await this.wishlistRepository.save(wishlist);
    }

    return wishlist;
  }

  async removeProduct(userId: string, productId: string): Promise<Wishlist> {
    const wishlist = await this.getOrCreateWishlist(userId);

    const productLengthBefore = wishlist.products.length;
    wishlist.products = wishlist.products.filter((p) => p.id !== productId);

    if (wishlist.products.length !== productLengthBefore) {
      await this.wishlistRepository.save(wishlist);
    }

    return wishlist;
  }
}
