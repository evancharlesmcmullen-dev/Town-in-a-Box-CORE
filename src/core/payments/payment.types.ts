// src/core/payments/payment.types.ts

export type PaymentMethodType =
  | 'card'
  | 'ach'
  | 'cash'
  | 'check'
  | 'external';

export interface PaymentIntent {
  id: string;
  tenantId: string;

  description: string;
  amountCents: number;

  createdAt: Date;
  expiresAt?: Date;

  // Link to the thing being paid, e.g. Bill or FeeCalculationResult.
  targetType?: string;
  targetId?: string;
}

export interface Payment {
  id: string;
  tenantId: string;

  intentId: string;

  method: PaymentMethodType;
  amountCents: number;

  createdAt: Date;
  confirmedAt?: Date;

  providerRef?: string;      // e.g. Stripe charge id
}