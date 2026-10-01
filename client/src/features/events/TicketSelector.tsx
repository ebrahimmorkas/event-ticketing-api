import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import type { TicketTier } from '@/lib/types';

/** The API allows at most 10 tickets per tier in a single booking. */
export const MAX_PER_TIER = 10;

interface Props {
  tiers: TicketTier[];
  quantities: Record<string, number>;
  onChange: (tierId: string, quantity: number) => void;
  disabled?: boolean;
}

export function TicketSelector({ tiers, quantities, onChange, disabled }: Props) {
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {tiers.map((tier) => {
        const quantity = quantities[tier.id] ?? 0;
        const max = Math.min(MAX_PER_TIER, tier.available);
        const soldOut = tier.available === 0;
        return (
          <li key={tier.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-medium">{tier.name}</p>
              <p className="text-sm text-slate-500">
                {formatPrice(tier.priceCents)} ·{' '}
                {soldOut ? (
                  <span className="text-red-600">Sold out</span>
                ) : (
                  `${tier.available} available`
                )}
              </p>
            </div>
            <div
              className="flex items-center gap-2"
              role="group"
              aria-label={`${tier.name} quantity`}
            >
              <Button
                variant="secondary"
                size="icon"
                aria-label={`Remove one ${tier.name} ticket`}
                disabled={disabled || quantity === 0}
                onClick={() => onChange(tier.id, quantity - 1)}
              >
                <Minus />
              </Button>
              <output className="w-6 text-center font-semibold tabular-nums" aria-live="polite">
                {quantity}
              </output>
              <Button
                variant="secondary"
                size="icon"
                aria-label={`Add one ${tier.name} ticket`}
                disabled={disabled || quantity >= max}
                onClick={() => onChange(tier.id, quantity + 1)}
              >
                <Plus />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
