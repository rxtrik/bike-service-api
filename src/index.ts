import express from 'express';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`Serwer działa pod adresem http://localhost:${PORT}`);
});