import { randomUUID } from 'node:crypto';

export interface ChargeRequest {
  amountCents: number;
  currency: string;
  paymentMethod: string;
  reference: string;
}

export type ChargeResult =
  { success: true; paymentRef: string } | { success: false; reason: string };

/**
 * Payment gateway port. The app depends only on this interface, so swapping the
 * mock for Stripe/Razorpay is a matter of adding another implementation.
 */
export interface PaymentProvider {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(paymentRef: string): Promise<void>;
}

/**
 * Deterministic test gateway modelled on Stripe's test cards:
 * `pm_card_declined` and `pm_card_insufficient_funds` fail, anything else succeeds.
 */
export class MockPaymentProvider implements PaymentProvider {
  private static readonly FAILURES: Record<string, string> = {
    pm_card_declined: 'Card was declined',
    pm_card_insufficient_funds: 'Insufficient funds',
  };

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const reason = MockPaymentProvider.FAILURES[request.paymentMethod];
    if (reason) return { success: false, reason };
    return { success: true, paymentRef: `mock_ch_${randomUUID()}` };
  }

  async refund(_paymentRef: string): Promise<void> {}
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
