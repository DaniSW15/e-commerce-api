import { Test, TestingModule } from '@nestjs/testing';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('WishlistController', () => {
  let controller: WishlistController;
  let service: jest.Mocked<any>;

  beforeEach(async () => {
    const mockWishlistService = {
      getOrCreateWishlist: jest.fn(),
      addProduct: jest.fn(),
      removeProduct: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistController],
      providers: [{ provide: WishlistService, useValue: mockWishlistService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<WishlistController>(WishlistController);
    service = module.get(WishlistService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getWishlist', () => {
    it('should call service.getOrCreateWishlist with user ID', async () => {
      const userId = 'user-1';
      const mockResult = { id: 'w-1', userId, products: [] };
      service.getOrCreateWishlist.mockResolvedValueOnce(mockResult);

      const result = await controller.getWishlist(userId);
      expect(result).toEqual(mockResult);
      expect(service.getOrCreateWishlist).toHaveBeenCalledWith(userId);
    });
  });

  describe('addProduct', () => {
    it('should call service.addProduct with correct params', async () => {
      const userId = 'user-1';
      const productId = 'prod-1';
      const mockResult = { id: 'w-1', userId, products: [{ id: productId }] };
      service.addProduct.mockResolvedValueOnce(mockResult);

      const result = await controller.addProduct(userId, productId);
      expect(result).toEqual(mockResult);
      expect(service.addProduct).toHaveBeenCalledWith(userId, productId);
    });
  });

  describe('removeProduct', () => {
    it('should call service.removeProduct with correct params', async () => {
      const userId = 'user-1';
      const productId = 'prod-1';
      const mockResult = { id: 'w-1', userId, products: [] };
      service.removeProduct.mockResolvedValueOnce(mockResult);

      const result = await controller.removeProduct(userId, productId);
      expect(result).toEqual(mockResult);
      expect(service.removeProduct).toHaveBeenCalledWith(userId, productId);
    });
  });
});
