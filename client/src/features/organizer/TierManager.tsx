import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/form';
import { errorMessage } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { TicketTier } from '@/lib/types';
import { useAddTier, useUpdateTier } from './api';
import { tierSchema, toTierInput, type TierFormInput, type TierFormValues } from './schemas';

interface Props {
  eventId: string;
  tiers: TicketTier[];
  readOnly: boolean;
}

export function TierManager({ eventId, tiers, readOnly }: Props) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ticket tiers</CardTitle>
        {!readOnly && editing === null && (
          <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
            <Plus aria-hidden /> Add tier
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {tiers.length === 0 && editing !== 'new' && (
          <Alert tone="info">Add at least one ticket tier before publishing.</Alert>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {tiers.map((tier) =>
            editing === tier.id ? (
              <li key={tier.id} className="py-3">
                <TierForm eventId={eventId} tier={tier} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={tier.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{tier.name}</p>
                  <p className="text-sm text-slate-500">
                    {formatPrice(tier.priceCents)} · {tier.capacity - tier.available} of{' '}
                    {tier.capacity} taken
                  </p>
                </div>
                {!readOnly && editing === null && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${tier.name}`}
                    onClick={() => setEditing(tier.id)}
                  >
                    <Pencil />
                  </Button>
                )}
              </li>
            ),
          )}
        </ul>
        {editing === 'new' && <TierForm eventId={eventId} onDone={() => setEditing(null)} />}
      </CardContent>
    </Card>
  );
}

function TierForm({
  eventId,
  tier,
  onDone,
}: {
  eventId: string;
  tier?: TicketTier;
  onDone: () => void;
}) {
  const addTier = useAddTier(eventId);
  const updateTier = useUpdateTier(eventId);
  const mutation = tier ? updateTier : addTier;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TierFormInput, unknown, TierFormValues>({
    resolver: zodResolver(tierSchema),
    defaultValues: tier
      ? { name: tier.name, price: String(tier.priceCents / 100), capacity: String(tier.capacity) }
      : { name: '', price: '0', capacity: '50' },
  });

  const onSubmit = (values: TierFormValues) => {
    const input = toTierInput(values);
    const options = {
      onSuccess: () => {
        toast.success(tier ? 'Tier updated' : 'Tier added');
        onDone();
      },
    };
    if (tier) updateTier.mutate({ tierId: tier.id, ...input }, options);
    else addTier.mutate(input, options);
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" error={errors.name?.message}>
          <Input autoFocus {...register('name')} />
        </Field>
        <Field label="Price (USD)" error={errors.price?.message}>
          <Input type="number" min={0} step="0.01" {...register('price')} />
        </Field>
        <Field label="Capacity" error={errors.capacity?.message}>
          <Input type="number" min={1} {...register('capacity')} />
        </Field>
      </div>
      {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={mutation.isPending}>
          {tier ? 'Save tier' : 'Add tier'}
        </Button>
      </div>
    </form>
  );
}
