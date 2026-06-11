import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductReview } from '../products/entities/product-review.entity';
import { Product } from '../products/entities/product.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { UserRole } from '@/common/enums';
import { OrderStatus } from '../orders/entities/order.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ProductReview)
    private readonly reviewRepository: Repository<ProductReview>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
  ) {}

  async create(
    userId: string,
    productId: string,
    dto: CreateReviewDto,
  ): Promise<ProductReview> {
    // 1. Verificar que el producto existe
    await this.productsService.findById(productId);

    // 2. Verificar si el usuario ya escribió una reseña para este producto
    const existingReview = await this.reviewRepository.findOne({
      where: { userId, productId },
    });
    if (existingReview) {
      throw new ConflictException('You have already reviewed this product');
    }

    // 3. Validar historial de compras (el usuario debe tener una orden no cancelada del producto)
    const userOrders = await this.ordersService.findByUser(userId);
    const hasPurchased = userOrders.some(
      (order) =>
        order.orderStatus !== OrderStatus.CANCELLED &&
        order.orderItems.some((item) => item.productId === productId),
    );

    if (!hasPurchased) {
      throw new ForbiddenException(
        'You can only review products you have purchased',
      );
    }

    // 4. Crear reseña
    const review = this.reviewRepository.create({
      userId,
      productId,
      rating: dto.rating,
      comment: dto.comment,
    });
    const savedReview = await this.reviewRepository.save(review);

    // 5. Recalcular promedio y cantidad de reseñas
    await this.updateProductStats(productId);

    return savedReview;
  }

  async findByProduct(
    productId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: ProductReview[]; meta: any }> {
    await this.productsService.findById(productId); // Verifica existencia del producto

    const [data, total] = await this.reviewRepository.findAndCount({
      where: { productId },
      relations: {
        user: {
          profile: true,
        },
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Sanitizar contraseña y secretos de los usuarios en los resultados
    const sanitizedData = data.map((review) => {
      if (review.user) {
        delete (review.user as any).password;
        delete (review.user as any).twoFactorSecret;
      }
      return review;
    });

    return {
      data: sanitizedData,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async delete(
    reviewId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<{ message: string }> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // El autor de la reseña o un administrador pueden eliminarla
    const isAdmin =
      userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
    if (review.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    const productId = review.productId;
    await this.reviewRepository.remove(review);

    // Recalcular promedio y cantidad de reseñas
    await this.updateProductStats(productId);

    return { message: 'Review deleted successfully' };
  }

  private async updateProductStats(productId: string): Promise<void> {
    const reviews = await this.reviewRepository.find({
      where: { productId },
      select: { rating: true },
    });

    const reviewCount = reviews.length;
    const averageRating =
      reviewCount > 0
        ? Number(
            (
              reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            ).toFixed(2),
          )
        : 0.0;

    await this.productRepository.update(productId, {
      averageRating,
      reviewCount,
    });
  }
}
