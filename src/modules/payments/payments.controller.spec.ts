import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: jest.Mocked<any>;

  beforeEach(async () => {
    const mockPaymentsService = {
      createPaymentIntent: jest.fn(),
      getPaymentByOrder: jest.fn(),
      refund: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createIntent', () => {
    it('should call service.createPaymentIntent', async () => {
      const dto: CreatePaymentIntentDto = { orderId: 'ord-1' };
      service.createPaymentIntent.mockResolvedValueOnce({
        clientSecret: 'secret',
      });

      const result = await controller.createIntent('u-1', dto);
      expect(result).toEqual({ clientSecret: 'secret' });
      expect(service.createPaymentIntent).toHaveBeenCalledWith('ord-1', 'u-1');
    });
  });

  describe('getPaymentIntent', () => {
    it('should return metadata if payment exists', async () => {
      const payment = { id: 'pay-1', metadata: { some: 'meta' } };
      service.getPaymentByOrder.mockResolvedValueOnce(payment);

      const result = await controller.getPaymentIntent('u-1', 'ord-1');
      expect(result).toEqual({ some: 'meta' });
      expect(service.getPaymentByOrder).toHaveBeenCalledWith('ord-1');
    });

    it('should return null if payment does not exist', async () => {
      service.getPaymentByOrder.mockResolvedValueOnce(null);

      const result = await controller.getPaymentIntent('u-1', 'ord-1');
      expect(result).toBeNull();
      expect(service.getPaymentByOrder).toHaveBeenCalledWith('ord-1');
    });
  });

  describe('refundPayment', () => {
    it('should call service.refund', async () => {
      service.refund.mockResolvedValueOnce({ status: 'refunded' });

      const result = await controller.refundPayment('pay-1', 100);
      expect(result).toEqual({ status: 'refunded' });
      expect(service.refund).toHaveBeenCalledWith('pay-1', 100);
    });
  });
});
