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
  let dataSource: jest.Mocked<any>;

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
    dataSource = module.get(DataSource);
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

    it('should update existing item quantity in cart', async () => {
      const product = { id: 'p-id', stockQuantity: 10, price: 50 };
      const cart = {
        id: 'cart-id',
        userId: 'user-id',
        items: [
          {
            id: 'item-1',
            productId: 'p-id',
            quantity: 2,
            price: 50,
            subtotal: 100,
          },
        ],
      };
      productsService.findById.mockResolvedValueOnce(product);
      cartRepo.findOne.mockResolvedValueOnce(cart); // getOrCreateCart
      cartItemRepo.save.mockResolvedValue({});

      // recalculateCart
      cartRepo.findOne.mockResolvedValueOnce({
        ...cart,
        items: [
          {
            id: 'item-1',
            productId: 'p-id',
            quantity: 4,
            price: 50,
            subtotal: 200,
          },
        ],
      });
      cartRepo.save.mockResolvedValue({});

      await service.addItem('user-id', {
        productId: 'p-id',
        quantity: 2,
      });
      expect(cartItemRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if new quantity exceeds stock', async () => {
      const product = { id: 'p-id', stockQuantity: 3, price: 50 };
      const cart = {
        id: 'cart-id',
        userId: 'user-id',
        items: [
          {
            id: 'item-1',
            productId: 'p-id',
            quantity: 2,
            price: 50,
            subtotal: 100,
          },
        ],
      };
      productsService.findById.mockResolvedValueOnce(product);
      cartRepo.findOne.mockResolvedValueOnce(cart); // getOrCreateCart

      await expect(
        service.addItem('user-id', { productId: 'p-id', quantity: 2 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateItem', () => {
    it('should throw NotFoundException if item not found in cart', async () => {
      cartRepo.findOne.mockResolvedValueOnce({ id: 'cart-id' }); // getOrCreateCart
      cartItemRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateItem('user-id', 'item-1', { quantity: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if quantity exceeds stock on update', async () => {
      cartRepo.findOne.mockResolvedValueOnce({ id: 'cart-id' }); // getOrCreateCart
      cartItemRepo.findOne.mockResolvedValueOnce({
        id: 'item-1',
        productId: 'p-1',
        product: { stockQuantity: 2 },
      });

      await expect(
        service.updateItem('user-id', 'item-1', { quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update item and recalculate cart', async () => {
      const cart = { id: 'cart-id' };
      cartRepo.findOne.mockResolvedValueOnce(cart); // getOrCreateCart
      const cartItem = {
        id: 'item-1',
        price: 50,
        quantity: 2,
        product: { stockQuantity: 10 },
      };
      cartItemRepo.findOne.mockResolvedValueOnce(cartItem);
      cartItemRepo.save.mockResolvedValueOnce({});

      // recalculateCart
      cartRepo.findOne.mockResolvedValueOnce({
        id: 'cart-id',
        items: [{ subtotal: 150, quantity: 3 }],
      });
      cartRepo.save.mockResolvedValueOnce({});

      await service.updateItem('user-id', 'item-1', {
        quantity: 3,
      });
      expect(cartItemRepo.save).toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('should throw NotFoundException if item not in cart', async () => {
      cartRepo.findOne.mockResolvedValueOnce({ id: 'cart-id' }); // getOrCreateCart
      cartItemRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.removeItem('user-id', 'item-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove item and recalculate cart', async () => {
      cartRepo.findOne.mockResolvedValueOnce({ id: 'cart-id' }); // getOrCreateCart
      const cartItem = { id: 'item-1' };
      cartItemRepo.findOne.mockResolvedValueOnce(cartItem);
      cartItemRepo.remove.mockResolvedValueOnce({});

      // recalculateCart
      cartRepo.findOne.mockResolvedValueOnce({ id: 'cart-id', items: [] });
      cartRepo.save.mockResolvedValueOnce({});

      await service.removeItem('user-id', 'item-1');
      expect(cartItemRepo.remove).toHaveBeenCalledWith(cartItem);
    });
  });

  describe('clearCart', () => {
    it('should throw NotFoundException if cart not found', async () => {
      cartRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.clearCart('user-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clear all items and reset totals', async () => {
      const cart = { id: 'cart-id', items: [{ id: 'item-1' }] };
      cartRepo.findOne.mockResolvedValueOnce(cart);
      cartItemRepo.delete.mockResolvedValueOnce({});
      cartRepo.save.mockResolvedValueOnce({});

      const result = await service.clearCart('user-id');
      expect(result.message).toContain('cleared successfully');
      expect(cartItemRepo.delete).toHaveBeenCalledWith({ cartId: 'cart-id' });
      expect(dataSource.manager.clear).toHaveBeenCalled();
    });
  });

  describe('getCart', () => {
    it('should return cart using query builder', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        cache: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValueOnce({ id: 'cart-id', items: [] }),
      };
      cartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getCart('user-id');
      expect(result.id).toBe('cart-id');
    });

    it('should create cart if query builder returns null', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        cache: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValueOnce(null),
      };
      cartRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // getOrCreateCart -> findOne (null) -> create -> save
      cartRepo.findOne.mockResolvedValueOnce(null);
      cartRepo.create.mockReturnValue({ id: 'new-cart', items: [] });
      cartRepo.save.mockResolvedValueOnce({ id: 'new-cart', items: [] });

      const result = await service.getCart('user-id');
      expect(result.id).toBe('new-cart');
    });
  });
});
