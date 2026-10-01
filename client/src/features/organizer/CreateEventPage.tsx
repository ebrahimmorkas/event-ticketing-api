import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, type UseFormRegister } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/form';
import { errorMessage } from '@/lib/api';
import { useCreateEvent } from './api';
import { EventDetailsFields } from './EventDetailsFields';
import {
  createEventSchema,
  toEventInput,
  toTierInput,
  type CreateEventInput,
  type CreateEventValues,
  type EventDetailsValues,
} from './schemas';

export function CreateEventPage() {
  const navigate = useNavigate();
  const createEvent = useCreateEvent();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEventInput, unknown, CreateEventValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: '',
      description: '',
      venue: '',
      city: '',
      startsAt: '',
      endsAt: '',
      tiers: [{ name: 'General admission', price: '25', capacity: '100' }],
    },
  });
  const tiers = useFieldArray({ control, name: 'tiers' });

  const onSubmit = (values: CreateEventValues) =>
    createEvent.mutate(
      { ...toEventInput(values), tiers: values.tiers.map(toTierInput) },
      {
        onSuccess: (event) => {
          toast.success('Event saved as a draft');
          navigate(`/organizer/events/${event.id}`);
        },
      },
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">New event</h1>
        <p className="mt-1 text-slate-500">
          Events are saved as drafts. Publish when you are ready to sell tickets.
        </p>
      </header>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <EventDetailsFields
              register={register as unknown as UseFormRegister<EventDetailsValues>}
              errors={errors}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ticket tiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.tiers?.root?.message && <Alert>{errors.tiers.root.message}</Alert>}
            {errors.tiers?.message && <Alert>{errors.tiers.message}</Alert>}
            {tiers.fields.map((field, index) => (
              <fieldset
                key={field.id}
                className="grid items-start gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_1fr_auto] dark:border-slate-800"
              >
                <legend className="sr-only">Tier {index + 1}</legend>
                <Field label="Name" error={errors.tiers?.[index]?.name?.message}>
                  <Input {...register(`tiers.${index}.name`)} />
                </Field>
                <Field label="Price (USD)" error={errors.tiers?.[index]?.price?.message}>
                  <Input type="number" min={0} step="0.01" {...register(`tiers.${index}.price`)} />
                </Field>
                <Field label="Capacity" error={errors.tiers?.[index]?.capacity?.message}>
                  <Input type="number" min={1} {...register(`tiers.${index}.capacity`)} />
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-7 text-red-600"
                  aria-label={`Remove tier ${index + 1}`}
                  onClick={() => tiers.remove(index)}
                >
                  <Trash2 />
                </Button>
              </fieldset>
            ))}
            <Button
              variant="secondary"
              onClick={() => tiers.append({ name: '', price: '0', capacity: '50' })}
              disabled={tiers.fields.length >= 20}
            >
              <Plus aria-hidden /> Add tier
            </Button>
          </CardContent>
        </Card>

        {createEvent.isError && <Alert>{errorMessage(createEvent.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate('/organizer')}>
            Cancel
          </Button>
          <Button type="submit" loading={createEvent.isPending}>
            Save draft
          </Button>
        </div>
      </form>
    </div>
  );
}
