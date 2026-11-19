import { Router } from 'express';
import {
  availabilityQuerySchema,
  createOrderSchema,
  updateOrderStatusSchema,
} from '../schemas/order.schema';
import {
  AppError,
  createServiceOrder,
  getBikeServiceHistory,
  getMechanicAvailability,
  updateOrderStatus,
} from '../services/order.service';

export const ordersRouter = Router();

ordersRouter.get('/availability', async (req, res) => {
  const parsed = availabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Nieprawidłowe parametry zapytania',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await getMechanicAvailability(
      parsed.data.mechanicId,
      parsed.data.date,
      parsed.data.durationMinutes
    );
    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas sprawdzania dostępności mechanika' });
  }
});

ordersRouter.post('/', async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Błąd walidacji danych',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const order = await createServiceOrder(parsed.data);
    res.status(201).json(order);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera podczas tworzenia zlecenia' });
  }
});

ordersRouter.patch('/:id/status', async (req, res) => {
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Błąd walidacji danych',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const updatedOrder = await updateOrderStatus(String(req.params.id), parsed.data);
    res.json(updatedOrder);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas aktualizacji statusu zlecenia' });
  }
});

ordersRouter.get('/bike/:frameNumber', async (req, res) => {
  try {
    const history = await getBikeServiceHistory(String(req.params.frameNumber));
    res.json(history);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas pobierania historii serwisowej' });
  }
});