import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UserRole } from '@/common/enums';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: jest.Mocked<any>;

  beforeEach(async () => {
    const mockReviewsService = {
      create: jest.fn(),
      findByProduct: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<ReviewsController>(ReviewsController);
    service = module.get(ReviewsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createReview', () => {
    it('should call service.create with correct parameters', async () => {
      const productId = 'prod-1';
      const userId = 'user-1';
      const dto: CreateReviewDto = { rating: 5, comment: 'Great!' };
      service.create.mockResolvedValueOnce({ id: 'rev-1', ...dto });

      const result = await controller.createReview(productId, userId, dto);
      expect(result).toEqual({ id: 'rev-1', ...dto });
      expect(service.create).toHaveBeenCalledWith(userId, productId, dto);
    });
  });

  describe('getReviews', () => {
    it('should call service.findByProduct with default pagination values', async () => {
      const productId = 'prod-1';
      const mockResult = { data: [], meta: {} };
      service.findByProduct.mockResolvedValueOnce(mockResult);

      const result = await controller.getReviews(productId, 1, 10);
      expect(result).toEqual(mockResult);
      expect(service.findByProduct).toHaveBeenCalledWith(productId, 1, 10);
    });
  });

  describe('deleteReview', () => {
    it('should call service.delete with correct parameters', async () => {
      const reviewId = 'rev-1';
      const userId = 'user-1';
      const role = UserRole.CUSTOMER;
      service.delete.mockResolvedValueOnce({ message: 'deleted successfully' });

      const result = await controller.deleteReview(reviewId, userId, role);
      expect(result).toEqual({ message: 'deleted successfully' });
      expect(service.delete).toHaveBeenCalledWith(reviewId, userId, role);
    });
  });
});
