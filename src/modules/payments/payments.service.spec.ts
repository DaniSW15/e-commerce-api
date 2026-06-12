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

  describe('handleWebhook', () => {
    let stripeMock: any;

    beforeEach(() => {
      stripeMock = (service as any).stripe;
    });

    it('should log unhandled event type for default case', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockEvent = {
        type: 'unhandled.event',
      } as any;

      await service.handleWebhook(mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Unhandled event type: unhandled.event',
      );
      consoleSpy.mockRestore();
    });

    it('should handle payment succeeded - success with latest_charge as object', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            latest_charge: { id: 'ch_test' },
          },
        },
      } as any;

      stripeMock.charges.retrieve.mockResolvedValueOnce({
        receipt_url: 'http://receipt.url',
      });

      const mockPayment = {
        id: 'payment-id',
        orderId: 'order-id',
        status: PaymentStatus.PENDING,
        metadata: {},
      };

      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      await service.handleWebhook(mockEvent);

      expect(stripeMock.charges.retrieve).toHaveBeenCalledWith('ch_test');
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.COMPLETED,
          metadata: { receiptUrl: 'http://receipt.url' },
        }),
      );
      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        'order-id',
        OrderStatus.PAID,
      );
    });

    it('should handle payment succeeded - success with latest_charge as string', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            latest_charge: 'ch_string_test',
          },
        },
      } as any;

      stripeMock.charges.retrieve.mockResolvedValueOnce({
        receipt_url: 'http://receipt2.url',
      });

      const mockPayment = {
        id: 'payment-id',
        orderId: 'order-id',
        status: PaymentStatus.PENDING,
        metadata: {},
      };

      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      await service.handleWebhook(mockEvent);

      expect(stripeMock.charges.retrieve).toHaveBeenCalledWith(
        'ch_string_test',
      );
    });

    it('should handle payment succeeded - charge retrieve error', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            latest_charge: 'ch_error',
          },
        },
      } as any;

      stripeMock.charges.retrieve.mockRejectedValueOnce(
        new Error('Stripe error'),
      );
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockPayment = {
        id: 'payment-id',
        orderId: 'order-id',
        status: PaymentStatus.PENDING,
        metadata: {},
      };

      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      await service.handleWebhook(mockEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error retrieving charge:',
        expect.any(Error),
      );
      expect(paymentRepo.save).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle payment succeeded - payment not found in db', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_not_found',
          },
        },
      } as any;

      paymentRepo.findOne.mockResolvedValueOnce(null);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.handleWebhook(mockEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Payment not found for intent:',
        'pi_not_found',
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle payment failed - payment found', async () => {
      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test',
            last_payment_error: { message: 'Card declined' },
          },
        },
      } as any;

      const mockPayment = {
        id: 'payment-id',
        status: PaymentStatus.PENDING,
      };

      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      await service.handleWebhook(mockEvent);

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.FAILED,
          failureReason: 'Card declined',
        }),
      );
    });

    it('should handle payment failed - payment not found', async () => {
      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_not_found',
          },
        },
      } as any;

      paymentRepo.findOne.mockResolvedValueOnce(null);

      await service.handleWebhook(mockEvent);

      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('should handle charge.refunded - full refund', async () => {
      const mockEvent = {
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: 'pi_test',
            refunds: {
              data: [{ amount: 1000 }],
            },
          },
        },
      } as any;

      const mockPayment = {
        id: 'payment-id',
        amount: 10,
        status: PaymentStatus.COMPLETED,
      };

      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      await service.handleWebhook(mockEvent);

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
        }),
      );
    });

    it('should handle charge.refunded - partial refund', async () => {
      const mockEvent = {
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: 'pi_test',
            refunds: {
              data: [{ amount: 500 }],
            },
          },
        },
      } as any;

      const mockPayment = {
        id: 'payment-id',
        amount: 10,
        status: PaymentStatus.COMPLETED,
      };

      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      await service.handleWebhook(mockEvent);

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.PARTIALLY_REFUNDED,
        }),
      );
    });

    it('should handle charge.refunded - payment not found', async () => {
      const mockEvent = {
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: 'pi_not_found',
          },
        },
      } as any;

      paymentRepo.findOne.mockResolvedValueOnce(null);

      await service.handleWebhook(mockEvent);

      expect(paymentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getters', () => {
    it('should get payment by order id', async () => {
      const mockPayment = { id: 'payment-id', orderId: 'order-id' };
      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      const result = await service.getPaymentByOrder('order-id');

      expect(paymentRepo.findOne).toHaveBeenCalledWith({
        where: { orderId: 'order-id' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should get payment history', async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'payment-id' }]),
      };
      paymentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getPaymentHistory('user-id');

      expect(paymentRepo.createQueryBuilder).toHaveBeenCalledWith('payment');
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'payment.order',
        'order',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'order.userId = :userId',
        { userId: 'user-id' },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'payment.createdAt',
        'DESC',
      );
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
      expect(result).toEqual([{ id: 'payment-id' }]);
    });
  });
});
