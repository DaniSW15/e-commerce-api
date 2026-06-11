import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { ProductsService } from '../products/products.service';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('CartService', () => {
  let service: CartService;
  let cartRepo: ReturnType<typeof mockRepository>;
  let cartItemRepo: ReturnType<typeof mockRepository>;
  let productsService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockProductsService = {
      findById: jest.fn(),
    };

    const mockDataSource = {
      manager: {
        clear: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: ProductsService, useValue: mockProductsService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Cart), useValue: mockRepository() },
        { provide: getRepositoryToken(CartItem), useValue: mockRepository() },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    cartRepo = module.get(getRepositoryToken(Cart));
    cartItemRepo = module.get(getRepositoryToken(CartItem));
    productsService = module.get(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateCart', () => {
    it('should return existing cart if found', async () => {
      const mockCart = { id: 'cart-id', userId: 'user-id', items: [] };
      cartRepo.findOne.mockResolvedValueOnce(mockCart);

      const result = await service.getOrCreateCart('user-id');
      expect(result).toEqual(mockCart);
      expect(cartRepo.findOne).toHaveBeenCalled();
    });

    it('should create and return new cart if not found', async () => {
      cartRepo.findOne.mockResolvedValueOnce(null);
      const mockCart = { id: 'cart-id', userId: 'user-id', items: [] };
      cartRepo.create.mockReturnValue(mockCart);
      cartRepo.save.mockResolvedValue(mockCart);

      const result = await service.getOrCreateCart('user-id');
      expect(result).toEqual(mockCart);
      expect(cartRepo.create).toHaveBeenCalled();
      expect(cartRepo.save).toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('should throw NotFoundException if product not found', async () => {
      productsService.findById.mockResolvedValueOnce(null);
      await expect(
        service.addItem('user-id', { productId: 'p-id', quantity: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if quantity exceeds product stock', async () => {
      productsService.findById.mockResolvedValueOnce({
        id: 'p-id',
        stockQuantity: 1,
      });
      await expect(
        service.addItem('user-id', { productId: 'p-id', quantity: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add item to cart and recalculate', async () => {
      const product = { id: 'p-id', stockQuantity: 10, price: 50 };
      const cart = { id: 'cart-id', userId: 'user-id', items: [] };
      productsService.findById.mockResolvedValueOnce(product);
      cartRepo.findOne.mockResolvedValueOnce(cart); // getOrCreateCart -> findOne
      cartItemRepo.create.mockReturnValue({ productId: 'p-id', quantity: 2 });
      cartItemRepo.save.mockResolvedValue({});

      // recalculateCart -> findOne
      const updatedCart = {
        id: 'cart-id',
        userId: 'user-id',
        items: [{ productId: 'p-id', quantity: 2, subtotal: 100 }],
      };
      cartRepo.findOne.mockResolvedValueOnce(updatedCart);
      cartRepo.save.mockResolvedValue(updatedCart);

      const result = await service.addItem('user-id', {
        productId: 'p-id',
        quantity: 2,
      });
      expect(result.items).toHaveLength(1);
      expect(cartItemRepo.save).toHaveBeenCalled();
    });
  });
});
