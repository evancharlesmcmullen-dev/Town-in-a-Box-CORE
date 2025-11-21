// src/core/payments/in-memory-payment.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/types';
import {
  PaymentIntent,
  Payment,
  PaymentMethodType,
} from './payment.types';
import {
  PaymentService,
  PaymentGatewayDriver,
} from './payment.service';

export interface InMemoryPaymentSeedData {
  intents?: PaymentIntent[];
  payments?: Payment[];
}

/**
 * In-memory PaymentService for demos/tests. Data is scoped per tenant and
 * persists only for the process lifetime.
 */
export class InMemoryPaymentService implements PaymentService {
  private intents: PaymentIntent[];
  private payments: Payment[];

  constructor(seed: InMemoryPaymentSeedData = {}) {
    this.intents = seed.intents ? [...seed.intents] : [];
    this.payments = seed.payments ? [...seed.payments] : [];
  }

  async createIntent(
    ctx: TenantContext,
    description: string,
    amountCents: number,
    targetType?: string,
    targetId?: string
  ): Promise<PaymentIntent> {
    const intent: PaymentIntent = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      description,
      amountCents,
      createdAt: new Date(),
      targetType,
      targetId,
    };

    this.intents.push(intent);
    return intent;
  }

  async confirmPayment(
    ctx: TenantContext,
    intentId: string,
    method: PaymentMethodType
  ): Promise<Payment> {
    const intent = this.intents.find(
      (i) => i.id === intentId && i.tenantId === ctx.tenantId
    );

    if (!intent) {
      throw new Error('Payment intent not found for tenant');
    }

    const payment: Payment = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      intentId: intent.id,
      method,
      amountCents: intent.amountCents,
      createdAt: new Date(),
      confirmedAt: new Date(),
    };

    this.payments.push(payment);
    return payment;
  }
}

/**
 * Simple gateway driver that delegates to a PaymentService.
 */
export class InMemoryPaymentGatewayDriver implements PaymentGatewayDriver {
  constructor(private paymentService: PaymentService) {}

  async createPayment(
    intent: PaymentIntent,
    method: PaymentMethodType
  ): Promise<Payment> {
    // Delegate confirmation through the service to keep consistency.
    return this.paymentService.confirmPayment(
      { tenantId: intent.tenantId, jurisdiction: {} as any },
      intent.id,
      method
    );
  }
}
