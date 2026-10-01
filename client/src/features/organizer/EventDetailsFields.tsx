import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Field, Input, Textarea } from '@/components/ui/form';
import type { EventDetailsValues } from './schemas';

interface Props {
  // Works for both the create form (details + tiers) and the edit form (details only).
  register: UseFormRegister<EventDetailsValues>;
  errors: FieldErrors<EventDetailsValues>;
}

export function EventDetailsFields({ register, errors }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Title" error={errors.title?.message} className="sm:col-span-2">
        <Input placeholder="e.g. React Summit 2026" {...register('title')} />
      </Field>
      <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
        <Textarea placeholder="What should attendees expect?" {...register('description')} />
      </Field>
      <Field label="Venue" error={errors.venue?.message}>
        <Input {...register('venue')} />
      </Field>
      <Field label="City" error={errors.city?.message}>
        <Input {...register('city')} />
      </Field>
      <Field label="Starts" error={errors.startsAt?.message}>
        <Input type="datetime-local" {...register('startsAt')} />
      </Field>
      <Field label="Ends" error={errors.endsAt?.message}>
        <Input type="datetime-local" {...register('endsAt')} />
      </Field>
    </div>
  );
}
