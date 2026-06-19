import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UserRole } from '@/common/enums';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<any>;

  beforeEach(async () => {
    const mockOrdersService = {
      create: jest.fn(),
      findByUser: jest.fn(),
      findById: jest.fn(),
      cancel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get(OrdersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create', async () => {
      const dto: CreateOrderDto = {
        shippingAddress: {
          street: '123 street',
          city: 'City',
          state: 'State',
          postalCode: '12345',
          country: 'Country',
        },
        billingAddress: {
          street: '123 street',
          city: 'City',
          state: 'State',
          postalCode: '12345',
          country: 'Country',
        },
      };
      service.create.mockResolvedValueOnce({ id: 'o-1' });

      const result = await controller.create('u-1', dto);
      expect(result).toEqual({ id: 'o-1' });
      expect(service.create).toHaveBeenCalledWith('u-1', dto);
    });
  });

  describe('findByUser', () => {
    it('should call service.findByUser', async () => {
      service.findByUser.mockResolvedValueOnce([]);

      const result = await controller.findByUser('u-1');
      expect(result).toEqual([]);
      expect(service.findByUser).toHaveBeenCalledWith('u-1');
    });
  });

  describe('findById', () => {
    it('should return order if belongs to user', async () => {
      const order = { id: 'o-1', userId: 'u-1' };
      service.findById.mockResolvedValueOnce(order);

      const result = await controller.findById('u-1', UserRole.CUSTOMER, 'o-1');
      expect(result).toEqual(order);
      expect(service.findById).toHaveBeenCalledWith('o-1');
    });

    it('should throw NotFoundException if order does not belong to user', async () => {
      const order = { id: 'o-1', userId: 'other-user' };
      service.findById.mockResolvedValueOnce(order);

      await expect(
        controller.findById('u-1', UserRole.CUSTOMER, 'o-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should call service.cancel', async () => {
      service.cancel.mockResolvedValueOnce({
        id: 'o-1',
        orderStatus: 'cancelled',
      });

      const result = await controller.cancel('u-1', UserRole.CUSTOMER, 'o-1');
      expect(result).toEqual({ id: 'o-1', orderStatus: 'cancelled' });
      expect(service.cancel).toHaveBeenCalledWith('o-1', 'u-1', false);
    });
  });
});
