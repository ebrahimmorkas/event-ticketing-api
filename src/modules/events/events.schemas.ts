import { z } from 'zod';

export const tierInputSchema = z.object({
  name: z.string().trim().min(1).max(50),
  priceCents: z.number().int().min(0),
  capacity: z.number().int().min(1).max(100_000),
});

const eventFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(5000).default(''),
  venue: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(100),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
};

const endsAfterStart = (e: { startsAt?: Date; endsAt?: Date }) =>
  !e.startsAt || !e.endsAt || e.endsAt > e.startsAt;

export const createEventSchema = z
  .object({
    ...eventFields,
    tiers: z.array(tierInputSchema).max(20).default([]),
  })
  .refine(endsAfterStart, { message: 'endsAt must be after startsAt', path: ['endsAt'] })
  .refine((e) => new Set(e.tiers.map((t) => t.name.toLowerCase())).size === e.tiers.length, {
    message: 'Tier names must be unique',
    path: ['tiers'],
  });

export const updateEventSchema = z
  .object(eventFields)
  .partial()
  .refine(endsAfterStart, { message: 'endsAt must be after startsAt', path: ['endsAt'] })
  .refine((e) => Object.keys(e).length > 0, { message: 'No fields to update' });

export const updateTierSchema = tierInputSchema
  .partial()
  .refine((t) => Object.keys(t).length > 0, { message: 'No fields to update' });

export const listEventsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['startsAt', '-startsAt', 'createdAt', '-createdAt']).default('startsAt'),
});

export const eventIdParams = z.object({ id: z.uuid() });
export const tierParams = z.object({ id: z.uuid(), tierId: z.uuid() });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type TierInput = z.infer<typeof tierInputSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuery>;
