import { Router } from 'express';
import { createOrderSchema } from '../schemas/order.schema';
import { AppError, createServiceOrder, getBikeServiceHistory } from '../services/order.service';

export const ordersRouter = Router();

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

ordersRouter.get('/bike/:frameNumber', async (req, res) => {
  try {
    const history = await getBikeServiceHistory(req.params.frameNumber);
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