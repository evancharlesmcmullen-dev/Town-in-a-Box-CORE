// src/core/payments/payment.service.ts

import { TenantContext } from '../tenancy/tenancy.types';
import { PaymentIntent, Payment, PaymentMethodType } from './payment.types';

export interface PaymentGatewayDriver {
  createPayment(
    intent: PaymentIntent,
    method: PaymentMethodType
  ): Promise<Payment>;
}

export interface PaymentService {
  createIntent(
    ctx: TenantContext,
    description: string,
    amountCents: number,
    targetType?: string,
    targetId?: string
  ): Promise<PaymentIntent>;

  confirmPayment(
    ctx: TenantContext,
    intentId: string,
    method: PaymentMethodType
  ): Promise<Payment>;
}