import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @ApiOperation({ summary: 'Create a payment intent for an order' })
  async createIntent(@CurrentUser('id') userId: string, @Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(dto.orderId, userId);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get payment intent for an order' })
  async getPaymentIntent(@CurrentUser('id') userId: string, @Param('orderId') orderId: string) {
   const payment = await this.paymentsService.getPaymentByOrder(orderId);
   return payment ? payment.metadata : null;
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund a payment' })
  async refundPayment(@Param('id') paymentId: string, @Body('amount') amount?: number) {
    return this.paymentsService.refund(paymentId, amount);
  }
}
