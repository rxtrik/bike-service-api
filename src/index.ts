import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { ordersRouter } from './routes/orders.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/catalog', async (_req, res) => {
  try {
    const [services, parts] = await Promise.all([
      prisma.serviceType.findMany({ orderBy: { name: 'asc' } }),
      prisma.part.findMany({ orderBy: { name: 'asc' } }),
    ]);

    res.json({ services, parts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Nie udało się pobrać katalogu usług i części' });
  }
});

app.get('/api/resources', async (_req, res) => {
  try {
    const [mechanics, bikes] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'MECHANIC' },
        select: { id: true, fullName: true, email: true },
      }),
      prisma.bike.findMany({ include: { owner: { select: { fullName: true } } } }),
    ]);

    res.json({ mechanics, bikes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Nie udało się pobrać zasobów' });
  }
});

app.use('/api/orders', ordersRouter);

app.listen(PORT, () => {
  console.log(`Serwer działa pod adresem http://localhost:${PORT}`);
});