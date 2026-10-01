import { z } from 'zod';

// Client-side mirrors of the API's event and tier schemas. Prices are entered in
// dollars and dates in local time; `toEventInput`/`toTierInput` convert them.

export const tierSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  price: z.coerce.number<string>().min(0, 'Cannot be negative').max(100_000),
  capacity: z.coerce
    .number<string>()
    .int('Whole number')
    .min(1, 'At least 1')
    .max(100_000, 'At most 100,000'),
});

export const eventDetailsSchema = z
  .object({
    title: z.string().trim().min(3, 'At least 3 characters').max(120),
    description: z.string().trim().max(5000),
    venue: z.string().trim().min(2, 'Venue is required').max(200),
    city: z.string().trim().min(2, 'City is required').max(100),
    startsAt: z.string().min(1, 'Start time is required'),
    endsAt: z.string().min(1, 'End time is required'),
  })
  .refine((e) => !e.startsAt || !e.endsAt || new Date(e.endsAt) > new Date(e.startsAt), {
    message: 'Must be after the start time',
    path: ['endsAt'],
  });

export const createEventSchema = eventDetailsSchema.and(
  z.object({
    tiers: z
      .array(tierSchema)
      .max(20)
      .refine((tiers) => new Set(tiers.map((t) => t.name.toLowerCase())).size === tiers.length, {
        message: 'Tier names must be unique',
      }),
  }),
);

export type TierFormInput = z.input<typeof tierSchema>;
export type TierFormValues = z.output<typeof tierSchema>;
export type EventDetailsValues = z.output<typeof eventDetailsSchema>;
export type CreateEventInput = z.input<typeof createEventSchema>;
export type CreateEventValues = z.output<typeof createEventSchema>;

export const toTierInput = (tier: TierFormValues) => ({
  name: tier.name,
  priceCents: Math.round(tier.price * 100),
  capacity: tier.capacity,
});

export const toEventInput = (values: EventDetailsValues) => ({
  title: values.title,
  description: values.description,
  venue: values.venue,
  city: values.city,
  startsAt: new Date(values.startsAt).toISOString(),
  endsAt: new Date(values.endsAt).toISOString(),
});
