import { z } from 'zod';

export const createOrderSchema = z.object({
  bikeId: z.string().uuid('Nieprawidłowe ID roweru'),
  mechanicId: z.string().uuid('Nieprawidłowe ID mechanika'),
  scheduledStart: z
    .string()
    .refine((val) => !Number.isNaN(Date.parse(val)), 'Nieprawidłowa data rozpoczęcia (wymagany format ISO)'),
  serviceIds: z.array(z.string().uuid()).min(1, 'Wybierz przynajmniej jedną usługę'),
  parts: z
    .array(
      z.object({
        partId: z.string().uuid(),
        quantity: z.number().int().positive('Ilość musi być większa od zera'),
      })
    )
    .optional()
    .default([]),
  mechanicNotes: z.string().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;export const updateOrderStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  mechanicNotes: z.string().max(500).optional(),
});

export const availabilityQuerySchema = z.object({
  mechanicId: z.string().uuid('Nieprawidłowe ID mechanika'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Wymagany format daty YYYY-MM-DD'),
  durationMinutes: z.coerce.number().int().min(15).max(480).default(60),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

