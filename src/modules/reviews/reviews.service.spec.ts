import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { ProductReview } from '../products/entities/product-review.entity';
import { Product } from '../products/entities/product.entity';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { UserRole } from '@/common/enums';
import { OrderStatus } from '../orders/entities/order.entity';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  findAndCount: jest.fn(),
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewRepo: ReturnType<typeof mockRepository>;
  let productRepo: ReturnType<typeof mockRepository>;
  let ordersService: jest.Mocked<any>;
  let productsService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockOrdersService = {
      findByUser: jest.fn(),
    };
    const mockProductsService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(ProductReview),
          useValue: mockRepository(),
        },
        { provide: getRepositoryToken(Product), useValue: mockRepository() },
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    reviewRepo = module.get(getRepositoryToken(ProductReview));
    productRepo = module.get(getRepositoryToken(Product));
    ordersService = module.get(OrdersService);
    productsService = module.get(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const userId = 'user-1';
    const productId = 'prod-1';
    const dto = { rating: 5, comment: 'Great product!' };

    it('should throw ConflictException if user already reviewed this product', async () => {
      productsService.findById.mockResolvedValueOnce({ id: productId });
      reviewRepo.findOne.mockResolvedValueOnce({ id: 'review-1' });

      await expect(service.create(userId, productId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ForbiddenException if user has not purchased this product', async () => {
      productsService.findById.mockResolvedValueOnce({ id: productId });
      reviewRepo.findOne.mockResolvedValueOnce(null);
      ordersService.findByUser.mockResolvedValueOnce([]); // No orders

      await expect(service.create(userId, productId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user has only cancelled orders for this product', async () => {
      productsService.findById.mockResolvedValueOnce({ id: productId });
      reviewRepo.findOne.mockResolvedValueOnce(null);
      ordersService.findByUser.mockResolvedValueOnce([
        {
          orderStatus: OrderStatus.CANCELLED,
          orderItems: [{ productId }],
        },
      ]);

      await expect(service.create(userId, productId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create review and update stats if valid purchase', async () => {
      productsService.findById.mockResolvedValueOnce({ id: productId });
      reviewRepo.findOne.mockResolvedValueOnce(null);
      ordersService.findByUser.mockResolvedValueOnce([
        {
          orderStatus: OrderStatus.PAID,
          orderItems: [{ productId }],
        },
      ]);
      const mockReview = { id: 'review-1', userId, productId, ...dto };
      reviewRepo.create.mockReturnValue(mockReview);
      reviewRepo.save.mockResolvedValueOnce(mockReview);
      reviewRepo.find.mockResolvedValueOnce([{ rating: 5 }]); // for updating stats
      productRepo.update.mockResolvedValueOnce({});

      const result = await service.create(userId, productId, dto);
      expect(result).toEqual(mockReview);
      expect(reviewRepo.create).toHaveBeenCalled();
      expect(productRepo.update).toHaveBeenCalledWith(productId, {
        averageRating: 5,
        reviewCount: 1,
      });
    });
  });

  describe('findByProduct', () => {
    const productId = 'prod-1';

    it('should return paginated reviews and metadata', async () => {
      productsService.findById.mockResolvedValueOnce({ id: productId });
      const mockReviews = [
        {
          id: 'review-1',
          rating: 4,
          comment: 'Good',
          user: {
            id: 'u-1',
            email: 'u1@test.com',
            password: 'hash',
            twoFactorSecret: 'secret',
          },
        },
      ];
      reviewRepo.findAndCount.mockResolvedValueOnce([mockReviews, 1]);

      const result = await service.findByProduct(productId, 1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].user.password).toBeUndefined();
      expect(result.data[0].user.twoFactorSecret).toBeUndefined();
      expect(result.meta.total).toBe(1);
    });
  });

  describe('delete', () => {
    const reviewId = 'rev-1';
    const userId = 'user-1';

    it('should throw NotFoundException if review not found', async () => {
      reviewRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.delete(reviewId, userId, UserRole.CUSTOMER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not author and not admin', async () => {
      reviewRepo.findOne.mockResolvedValueOnce({
        id: reviewId,
        userId: 'other-user',
        productId: 'p-1',
      });

      await expect(
        service.delete(reviewId, userId, UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should delete review and update stats if user is the author', async () => {
      const mockReview = { id: reviewId, userId, productId: 'p-1', rating: 4 };
      reviewRepo.findOne.mockResolvedValueOnce(mockReview);
      reviewRepo.remove.mockResolvedValueOnce(mockReview);
      reviewRepo.find.mockResolvedValueOnce([]); // no reviews left
      productRepo.update.mockResolvedValueOnce({});

      const result = await service.delete(reviewId, userId, UserRole.CUSTOMER);
      expect(result.message).toContain('deleted successfully');
      expect(reviewRepo.remove).toHaveBeenCalledWith(mockReview);
      expect(productRepo.update).toHaveBeenCalledWith('p-1', {
        averageRating: 0,
        reviewCount: 0,
      });
    });

    it('should delete review and update stats if user is an admin', async () => {
      const mockReview = {
        id: reviewId,
        userId: 'other-user',
        productId: 'p-1',
        rating: 4,
      };
      reviewRepo.findOne.mockResolvedValueOnce(mockReview);
      reviewRepo.remove.mockResolvedValueOnce(mockReview);
      reviewRepo.find.mockResolvedValueOnce([]);
      productRepo.update.mockResolvedValueOnce({});

      const result = await service.delete(reviewId, 'admin-id', UserRole.ADMIN);
      expect(result.message).toContain('deleted successfully');
      expect(reviewRepo.remove).toHaveBeenCalledWith(mockReview);
    });
  });
});
