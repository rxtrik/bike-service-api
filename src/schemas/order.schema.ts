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

export type CreateOrderInput = z.infer<typeof createOrderSchema>;