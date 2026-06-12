import { Test, TestingModule } from '@nestjs/testing';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PaymentsService } from '../payments.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => {
    return {
      webhooks: {
        constructEvent: jest.fn(),
      },
    };
  });
});

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let paymentsService: jest.Mocked<any>;
  let stripeMockInstance: any;

  beforeEach(async () => {
    const mockPaymentsService = {
      handleWebhook: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_123';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<StripeWebhookController>(StripeWebhookController);
    paymentsService = module.get(PaymentsService);

    // Get the mocked stripe instance attached to controller
    stripeMockInstance = (controller as any).stripe;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should throw BadRequestException if signature verification fails', async () => {
      const signature = 'invalid-sig';
      const rawBody = Buffer.from('{}');

      stripeMockInstance.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Verification failed');
      });

      await expect(
        controller.handleWebhook(signature, rawBody),
      ).rejects.toThrow(BadRequestException);

      expect(paymentsService.handleWebhook).not.toHaveBeenCalled();
    });

    it('should call paymentsService.handleWebhook and return success on valid signature', async () => {
      const signature = 'valid-sig';
      const rawBody = Buffer.from('{}');
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
      } as any;

      stripeMockInstance.webhooks.constructEvent.mockReturnValueOnce(mockEvent);
      paymentsService.handleWebhook.mockResolvedValueOnce(undefined);

      const result = await controller.handleWebhook(signature, rawBody);

      expect(result).toEqual({ received: true });
      expect(stripeMockInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        rawBody,
        signature,
        'whsec_123',
      );
      expect(paymentsService.handleWebhook).toHaveBeenCalledWith(mockEvent);
    });
  });
});
