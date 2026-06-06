import { Controller, Post, Headers, Body, RawBody, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentsService } from '../payments.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
    private readonly stripe: Stripe;
    private readonly endpointSecret: string;

    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly configService: ConfigService,
    ) {
        this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
            apiVersion: '2023-10-16',
        });
        this.endpointSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
    }

    @Post()
    async handleWebhook(
        @Headers('stripe-signature') signature: string,
        @Body() rawBody: Buffer,
    ) {
        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(
                rawBody,
                signature,
                this.endpointSecret,
            );
        } catch (err: any) {
            throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
        }

        await this.paymentsService.handleWebhook(event);

        return { received: true };
    }
}