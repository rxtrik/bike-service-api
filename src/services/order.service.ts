import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CreateOrderInput } from '../schemas/order.schema';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export async function createServiceOrder(input: CreateOrderInput) {
  const start = new Date(input.scheduledStart);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Weryfikacja roweru i mechanika
    const [bike, mechanic] = await Promise.all([
      tx.bike.findUnique({ where: { id: input.bikeId } }),
      tx.user.findUnique({ where: { id: input.mechanicId } }),
    ]);

    if (!bike) throw new AppError(404, 'Nie znaleziono roweru o podanym ID');
    if (!mechanic || mechanic.role !== 'MECHANIC') {
      throw new AppError(404, 'Wybrany pracownik nie istnieje lub nie jest mechanikiem');
    }

    // 2. Pobranie usług i wyliczenie czasu trwania oraz robocizny
    const uniqueServiceIds = [...new Set(input.serviceIds)];
    const services = await tx.serviceType.findMany({
      where: { id: { in: uniqueServiceIds } },
    });

    if (services.length !== uniqueServiceIds.length) {
      throw new AppError(400, 'Jedna lub więcej wybranych usług nie istnieje');
    }

    const totalMinutes = services.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const end = new Date(start.getTime() + totalMinutes * 60_000);

    // 3. Sprawdzenie kolizji w grafiku mechanika (nakładanie się przedziałów czasowych)
    const conflictingOrder = await tx.serviceOrder.findFirst({
      where: {
        mechanicId: input.mechanicId,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
      },
    });

    if (conflictingOrder) {
      throw new AppError(
        409,
        `Mechanik jest zajęty w tym oknie czasowym (kolizja ze zleceniem ${conflictingOrder.id})`
      );
    }

    // 4. Pobranie części i atomowe zdjęcie ze stanu magazynowego
    let partsTotal = 0;
    const orderPartsData: { partId: string; quantity: number; priceAtBooking: number }[] = [];

    for (const item of input.parts) {
      const part = await tx.part.findUnique({ where: { id: item.partId } });
      if (!part) {
        throw new AppError(404, `Nie znaleziono części o ID ${item.partId}`);
      }

      const updated = await tx.part.updateMany({
        where: {
          id: item.partId,
          stockQuantity: { gte: item.quantity },
        },
        data: {
          stockQuantity: { decrement: item.quantity },
        },
      });

      if (updated.count === 0) {
        throw new AppError(
          409,
          `Brak wystarczającej liczby sztuk na magazynie dla: ${part.name} (dostępne: ${part.stockQuantity})`
        );
      }

      const unitPrice = Number(part.unitPrice);
      partsTotal += unitPrice * item.quantity;
      orderPartsData.push({
        partId: part.id,
        quantity: item.quantity,
        priceAtBooking: unitPrice,
      });
    }

    // 5. Zapis zlecenia wraz z zamrożonymi cenami
    const servicesTotal = services.reduce((sum, s) => sum + Number(s.basePrice), 0);
    const totalPrice = servicesTotal + partsTotal;

    return tx.serviceOrder.create({
      data: {
        bikeId: input.bikeId,
        mechanicId: input.mechanicId,
        scheduledStart: start,
        scheduledEnd: end,
        totalPrice,
        mechanicNotes: input.mechanicNotes,
        services: {
          create: services.map((s) => ({
            serviceTypeId: s.id,
            priceAtBooking: Number(s.basePrice),
          })),
        },
        parts: {
          create: orderPartsData,
        },
      },
      include: {
        bike: true,
        mechanic: { select: { id: true, fullName: true, email: true } },
        services: { include: { serviceType: true } },
        parts: { include: { part: true } },
      },
    });
  });
}

export async function getBikeServiceHistory(frameNumber: string) {
  const bike = await prisma.bike.findUnique({
    where: { frameNumber },
    include: {
      owner: { select: { fullName: true, email: true } },
      orders: {
        orderBy: { scheduledStart: 'desc' },
        include: {
          mechanic: { select: { fullName: true } },
          services: { include: { serviceType: true } },
          parts: { include: { part: true } },
        },
      },
    },
  });

  if (!bike) {
    throw new AppError(404, `Nie znaleziono roweru o numerze ramy: ${frameNumber}`);
  }

  return bike;
}