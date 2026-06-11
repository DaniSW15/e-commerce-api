import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ProductsService } from '../products/products.service';
import { CartService } from '../cart/cart.service';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
});

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof mockRepository>;
  let orderItemRepo: ReturnType<typeof mockRepository>;
  let productsService: jest.Mocked<any>;
  let cartService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockProductsService = {
      updateStock: jest.fn(),
    };

    const mockCartService = {
      getCart: jest.fn(),
      clearCart: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn((cb) =>
        cb({
          create: jest.fn((entity, data) => data),
          save: jest.fn((entity) =>
            Promise.resolve({ id: 'order-id', ...entity }),
          ),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: ProductsService, useValue: mockProductsService },
        { provide: CartService, useValue: mockCartService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Order), useValue: mockRepository() },
        { provide: getRepositoryToken(OrderItem), useValue: mockRepository() },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepo = module.get(getRepositoryToken(Order));
    orderItemRepo = module.get(getRepositoryToken(OrderItem));
    productsService = module.get(ProductsService);
    cartService = module.get(CartService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if cart is empty', async () => {
      cartService.getCart.mockResolvedValueOnce({ items: [] });

      const dto = {
        shippingAddress: {
          street: '123',
          city: 'c',
          state: 's',
          country: 'co',
          postalCode: '1',
        },
        billingAddress: {
          street: '123',
          city: 'c',
          state: 's',
          country: 'co',
          postalCode: '1',
        },
      };

      await expect(service.create('user-id', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if product stock is insufficient', async () => {
      const mockCart = {
        items: [
          {
            productId: 'p-id',
            quantity: 5,
            product: {
              id: 'p-id',
              name: 'Product',
              stockQuantity: 2,
              price: 10,
            },
          },
        ],
      };
      cartService.getCart.mockResolvedValueOnce(mockCart);

      const dto = {
        shippingAddress: {
          street: '123',
          city: 'c',
          state: 's',
          country: 'co',
          postalCode: '1',
        },
        billingAddress: {
          street: '123',
          city: 'c',
          state: 's',
          country: 'co',
          postalCode: '1',
        },
      };

      await expect(service.create('user-id', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully create order and empty the cart', async () => {
      const mockCart = {
        items: [
          {
            productId: 'p-id',
            quantity: 1,
            product: {
              id: 'p-id',
              name: 'Product',
              stockQuantity: 10,
              price: 100,
            },
          },
        ],
      };
      cartService.getCart.mockResolvedValueOnce(mockCart);

      orderItemRepo.create.mockImplementation((data) => data);

      const mockOrder = { id: 'order-id', orderStatus: OrderStatus.PENDING };
      orderRepo.findOne.mockResolvedValueOnce(mockOrder); // Mock findById inside create

      const dto = {
        shippingAddress: {
          street: '123',
          city: 'c',
          state: 's',
          country: 'co',
          postalCode: '1',
        },
        billingAddress: {
          street: '123',
          city: 'c',
          state: 's',
          country: 'co',
          postalCode: '1',
        },
      };

      const result = await service.create('user-id', dto);

      expect(cartService.getCart).toHaveBeenCalledWith('user-id');
      expect(productsService.updateStock).toHaveBeenCalledWith('p-id', -1);
      expect(cartService.clearCart).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(mockOrder);
    });
  });
});
