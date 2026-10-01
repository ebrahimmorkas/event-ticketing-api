import { CreditCard } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { errorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The API uses a mock gateway modelled on Stripe's test payment methods. */
const TEST_CARDS = [
  { value: 'pm_card_visa', label: 'Visa •••• 4242', note: 'Succeeds' },
  { value: 'pm_card_declined', label: 'Visa •••• 0002', note: 'Declined' },
  { value: 'pm_card_insufficient_funds', label: 'Visa •••• 9995', note: 'Insufficient funds' },
];

interface Props {
  totalCents: number;
  onPay: (paymentMethod: string) => void;
  isPaying: boolean;
  error: unknown;
}

export function PaymentForm({ totalCents, onPay, isPaying, error }: Props) {
  const [method, setMethod] = useState(TEST_CARDS[0]!.value);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onPay(method);
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Payment method (test mode)</legend>
        {TEST_CARDS.map((card) => (
          <label
            key={card.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-focus-visible:ring-2 has-focus-visible:ring-brand-500',
              method === card.value
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                : 'border-slate-200 dark:border-slate-700',
            )}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={card.value}
              checked={method === card.value}
              onChange={() => setMethod(card.value)}
              className="accent-brand-600"
            />
            <CreditCard className="size-5 text-slate-500" aria-hidden />
            <span className="flex-1 text-sm font-medium">{card.label}</span>
            <span className="text-xs text-slate-500">{card.note}</span>
          </label>
        ))}
      </fieldset>
      {error != null && <Alert>{errorMessage(error)}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={isPaying}>
        {totalCents === 0 ? 'Get free tickets' : `Pay ${formatMoney(totalCents)}`}
      </Button>
    </form>
  );
}
