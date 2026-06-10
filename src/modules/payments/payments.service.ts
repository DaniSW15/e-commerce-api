import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Payment,
  PaymentProvider,
  PaymentStatus,
} from './entities/payment.entity';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../orders/entities/order.entity';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    });
  }

  // ==================== PAYMENT INTENT ====================

  async createPaymentIntent(orderId: string, userId: string) {
    // 1. Verificar orden
    const order = await this.ordersService.findById(orderId);

    if (order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    if (order.orderStatus !== OrderStatus.PENDING) {
      throw new BadRequestException('Order cannot be paid');
    }

    // 2. Crear Payment Intent en Stripe
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Stripe usa centavos
      currency: order.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: order.id,
        userId: userId,
      },
    });

    // 3. Guardar en DB
    const payment = this.paymentRepository.create({
      orderId: order.id,
      provider: PaymentProvider.STRIPE,
      providerTransactionId: paymentIntent.id,
      amount: order.total,
      currency: order.currency,
      status: PaymentStatus.PENDING,
      metadata: {
        clientSecret: paymentIntent.client_secret,
      },
    });

    await this.paymentRepository.save(payment);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: order.total,
      currency: order.currency,
    };
  }

  // ==================== CONFIRM WEBHOOK ====================

  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'charge.refunded':
        await this.handleRefund(event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    let receiptUrl: string | undefined;

    try {
      if (paymentIntent.latest_charge) {
        const charge = await this.stripe.charges.retrieve(
          typeof paymentIntent.latest_charge === 'string'
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge.id,
        );
        receiptUrl = charge.receipt_url;
      }
    } catch (error) {
      console.error('Error retrieving charge:', error);
    }

    const payment = await this.paymentRepository.findOne({
      where: { providerTransactionId: paymentIntent.id },
    });

    if (!payment) {
      console.error('Payment not found for intent:', paymentIntent.id);
      return;
    }

    // Actualizar pago
    payment.status = PaymentStatus.COMPLETED;
    payment.metadata = {
      ...payment.metadata,
      receiptUrl: receiptUrl,
    };
    await this.paymentRepository.save(payment);

    // Actualizar orden
    await this.ordersService.updateStatus(payment.orderId, OrderStatus.PAID);
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepository.findOne({
      where: { providerTransactionId: paymentIntent.id },
    });

    if (!payment) return;

    payment.status = PaymentStatus.FAILED;
    payment.failureReason = paymentIntent.last_payment_error?.message;
    await this.paymentRepository.save(payment);
  }

  private async handleRefund(charge: Stripe.Charge) {
    const payment = await this.paymentRepository.findOne({
      where: { providerTransactionId: charge.payment_intent as string },
    });

    if (!payment) return;

    const refundAmount = charge.refunds?.data[0]?.amount;
    const originalAmount = Math.round(payment.amount * 100);

    payment.status =
      refundAmount === originalAmount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

    await this.paymentRepository.save(payment);
  }

  // ==================== REFUND ====================

  async refund(paymentId: string, amount?: number) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment cannot be refunded');
    }

    const refund = await this.stripe.refunds.create({
      payment_intent: payment.providerTransactionId,
      amount: amount ? Math.round(amount * 100) : undefined,
    });

    return {
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount / 100,
    };
  }

  // ==================== GETTERS ====================

  async getPaymentByOrder(orderId: string) {
    return this.paymentRepository.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPaymentHistory(userId: string) {
    // Join con orders para filtrar por userId
    return this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.order', 'order')
      .where('order.userId = :userId', { userId })
      .orderBy('payment.createdAt', 'DESC')
      .getMany();
  }
}
