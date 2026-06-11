import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import {
  Payment,
  PaymentProvider,
  PaymentStatus,
} from './entities/payment.entity';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../orders/entities/order.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => {
    return {
      paymentIntents: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'pi_test', client_secret: 'secret_test' }),
      },
      charges: {
        retrieve: jest.fn(),
      },
      refunds: {
        create: jest.fn().mockResolvedValue({
          id: 'ref_test',
          status: 'succeeded',
          amount: 1000,
        }),
      },
    };
  });
});

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepo: ReturnType<typeof mockRepository>;
  let ordersService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockOrdersService = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('sk_test_mock'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(Payment), useValue: mockRepository() },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    ordersService = module.get(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should throw NotFoundException if order does not belong to user', async () => {
      ordersService.findById.mockResolvedValueOnce({
        id: 'order-id',
        userId: 'another-user-id',
      });

      await expect(
        service.createPaymentIntent('order-id', 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order status is not pending', async () => {
      ordersService.findById.mockResolvedValueOnce({
        id: 'order-id',
        userId: 'user-id',
        orderStatus: OrderStatus.PAID,
      });

      await expect(
        service.createPaymentIntent('order-id', 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create stripe payment intent and save payment info', async () => {
      const mockOrder = {
        id: 'order-id',
        userId: 'user-id',
        orderStatus: OrderStatus.PENDING,
        total: 10,
        currency: 'USD',
      };
      ordersService.findById.mockResolvedValueOnce(mockOrder);

      const mockPayment = {
        id: 'payment-id',
        orderId: 'order-id',
        provider: PaymentProvider.STRIPE,
        providerTransactionId: 'pi_test',
        amount: 10,
        currency: 'USD',
        status: PaymentStatus.PENDING,
      };

      paymentRepo.create.mockReturnValue(mockPayment);
      paymentRepo.save.mockResolvedValueOnce(mockPayment);

      const result = await service.createPaymentIntent('order-id', 'user-id');

      expect(ordersService.findById).toHaveBeenCalledWith('order-id');
      expect(paymentRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('clientSecret', 'secret_test');
    });
  });

  describe('refund', () => {
    it('should throw NotFoundException if payment is not found', async () => {
      paymentRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.refund('payment-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if payment is not completed', async () => {
      paymentRepo.findOne.mockResolvedValueOnce({
        id: 'payment-id',
        status: PaymentStatus.PENDING,
      });

      await expect(service.refund('payment-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call Stripe refund and return refund details', async () => {
      const mockPayment = {
        id: 'payment-id',
        status: PaymentStatus.COMPLETED,
        providerTransactionId: 'pi_test',
      };
      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      const result = await service.refund('payment-id', 10);

      expect(result).toHaveProperty('refundId', 'ref_test');
      expect(result.amount).toBe(10);
    });
  });
});
