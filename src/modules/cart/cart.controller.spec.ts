import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

describe('CartController', () => {
  let controller: CartController;
  let service: jest.Mocked<any>;

  beforeEach(async () => {
    const mockCartService = {
      getCart: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CartController>(CartController);
    service = module.get(CartService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCart', () => {
    it('should call service.getCart', async () => {
      const user = { id: 'u-1' } as any;
      service.getCart.mockResolvedValueOnce({
        id: 'c-1',
        userId: 'u-1',
        items: [],
      });

      const result = await controller.getCart(user);
      expect(result).toEqual({ id: 'c-1', userId: 'u-1', items: [] });
      expect(service.getCart).toHaveBeenCalledWith('u-1');
    });
  });

  describe('addItem', () => {
    it('should call service.addItem', async () => {
      const user = { id: 'u-1' } as any;
      const dto: AddToCartDto = { productId: 'p-1', quantity: 2 };
      service.addItem.mockResolvedValueOnce({ id: 'c-1' });

      const result = await controller.addItem(user, dto);
      expect(result).toEqual({ id: 'c-1' });
      expect(service.addItem).toHaveBeenCalledWith('u-1', dto);
    });
  });

  describe('updateItem', () => {
    it('should call service.updateItem', async () => {
      const user = { id: 'u-1' } as any;
      const dto: UpdateCartItemDto = { quantity: 5 };
      service.updateItem.mockResolvedValueOnce({ id: 'c-1' });

      const result = await controller.updateItem(user, 'item-1', dto);
      expect(result).toEqual({ id: 'c-1' });
      expect(service.updateItem).toHaveBeenCalledWith('u-1', 'item-1', dto);
    });
  });

  describe('removeItem', () => {
    it('should call service.removeItem', async () => {
      const user = { id: 'u-1' } as any;
      service.removeItem.mockResolvedValueOnce({ id: 'c-1' });

      const result = await controller.removeItem(user, 'item-1');
      expect(result).toEqual({ id: 'c-1' });
      expect(service.removeItem).toHaveBeenCalledWith('u-1', 'item-1');
    });
  });

  describe('clearCart', () => {
    it('should call service.clearCart', async () => {
      const user = { id: 'u-1' } as any;
      service.clearCart.mockResolvedValueOnce({ message: 'ok' });

      const result = await controller.clearCart(user);
      expect(result).toEqual({ message: 'ok' });
      expect(service.clearCart).toHaveBeenCalledWith('u-1');
    });
  });
});
