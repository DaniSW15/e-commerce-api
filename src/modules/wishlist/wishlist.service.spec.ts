import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WishlistService } from './wishlist.service';
import { Wishlist } from './entities/wishlist.entity';
import { ProductsService } from '@modules/products/products.service';
import { NotFoundException } from '@nestjs/common';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
});

describe('WishlistService', () => {
  let service: WishlistService;
  let wishlistRepo: ReturnType<typeof mockRepository>;
  let productsService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockProductsService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: ProductsService, useValue: mockProductsService },
        { provide: getRepositoryToken(Wishlist), useValue: mockRepository() },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
    wishlistRepo = module.get(getRepositoryToken(Wishlist));
    productsService = module.get(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateWishlist', () => {
    it('should return existing wishlist if found', async () => {
      const mockWishlist = { id: 'w-1', userId: 'user-1', products: [] };
      wishlistRepo.findOne.mockResolvedValueOnce(mockWishlist);

      const result = await service.getOrCreateWishlist('user-1');
      expect(result).toEqual(mockWishlist);
      expect(wishlistRepo.findOne).toHaveBeenCalled();
    });

    it('should create and return new wishlist if not found', async () => {
      wishlistRepo.findOne.mockResolvedValueOnce(null);
      const mockWishlist = { id: 'w-1', userId: 'user-1', products: [] };
      wishlistRepo.create.mockReturnValue(mockWishlist);
      wishlistRepo.save.mockResolvedValueOnce(mockWishlist);

      const result = await service.getOrCreateWishlist('user-1');
      expect(result).toEqual(mockWishlist);
      expect(wishlistRepo.create).toHaveBeenCalled();
      expect(wishlistRepo.save).toHaveBeenCalled();
    });
  });

  describe('addProduct', () => {
    it('should throw NotFoundException if product is not found', async () => {
      productsService.findById.mockResolvedValueOnce(null);

      await expect(service.addProduct('user-1', 'prod-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should add product to wishlist if not already present', async () => {
      const product = { id: 'prod-1', name: 'Product 1' };
      productsService.findById.mockResolvedValueOnce(product);
      wishlistRepo.findOne.mockResolvedValueOnce({
        id: 'w-1',
        userId: 'user-1',
        products: [],
      });
      wishlistRepo.save.mockResolvedValueOnce({
        id: 'w-1',
        userId: 'user-1',
        products: [product],
      });

      const result = await service.addProduct('user-1', 'prod-1');
      expect(result.products).toContainEqual(product);
      expect(wishlistRepo.save).toHaveBeenCalled();
    });

    it('should not add product again if already present in wishlist', async () => {
      const product = { id: 'prod-1', name: 'Product 1' };
      productsService.findById.mockResolvedValueOnce(product);
      wishlistRepo.findOne.mockResolvedValueOnce({
        id: 'w-1',
        userId: 'user-1',
        products: [product],
      });

      const result = await service.addProduct('user-1', 'prod-1');
      expect(result.products).toHaveLength(1);
      expect(wishlistRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('removeProduct', () => {
    it('should remove product from wishlist if present', async () => {
      const product = { id: 'prod-1', name: 'Product 1' };
      wishlistRepo.findOne.mockResolvedValueOnce({
        id: 'w-1',
        userId: 'user-1',
        products: [product],
      });
      wishlistRepo.save.mockResolvedValueOnce({
        id: 'w-1',
        userId: 'user-1',
        products: [],
      });

      const result = await service.removeProduct('user-1', 'prod-1');
      expect(result.products).toHaveLength(0);
      expect(wishlistRepo.save).toHaveBeenCalled();
    });

    it('should do nothing if product is not in wishlist', async () => {
      wishlistRepo.findOne.mockResolvedValueOnce({
        id: 'w-1',
        userId: 'user-1',
        products: [],
      });

      const result = await service.removeProduct('user-1', 'prod-1');
      expect(result.products).toHaveLength(0);
      expect(wishlistRepo.save).not.toHaveBeenCalled();
    });
  });
});
