import { PartialType } from '@nestjs/swagger';
import { CreatePaymentIntentDto } from './create-payment-intent.dto';

export class UpdatePaymentDto extends PartialType(CreatePaymentIntentDto) {}
