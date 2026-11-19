import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CreateOrderInput, UpdateOrderStatusInput } from '../schemas/order.schema';

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

export async function updateOrderStatus(orderId: string, input: UpdateOrderStatusInput) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.serviceOrder.findUnique({
      where: { id: orderId },
      include: { parts: true },
    });

    if (!order) {
      throw new AppError(404, 'Nie znaleziono zlecenia o podanym ID');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new AppError(
        400,
        `Nie można zmienić statusu zlecenia, które ma już status ${order.status}`
      );
    }

    // Jeśli zlecenie jest anulowane, zwracamy zarezerwowane części na magazyn
    if (input.status === 'CANCELLED') {
      for (const item of order.parts) {
        await tx.part.update({
          where: { id: item.partId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
    }

    return tx.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: input.status,
        mechanicNotes: input.mechanicNotes ?? order.mechanicNotes,
      },
      include: {
        bike: true,
        mechanic: { select: { id: true, fullName: true } },
        services: { include: { serviceType: true } },
        parts: { include: { part: true } },
      },
    });
  });
}

export async function getMechanicAvailability(
  mechanicId: string,
  dateStr: string,
  durationMinutes: number
) {
  const mechanic = await prisma.user.findUnique({ where: { id: mechanicId } });
  if (!mechanic || mechanic.role !== 'MECHANIC') {
    throw new AppError(404, 'Nie znaleziono mechanika o podanym ID');
  }

  // Godziny pracy serwisu: 09:00 - 17:00 UTC
  const dayStart = new Date(`${dateStr}T09:00:00.000Z`);
  const dayEnd = new Date(`${dateStr}T17:00:00.000Z`);

  const existingOrders = await prisma.serviceOrder.findMany({
    where: {
      mechanicId,
      status: { notIn: ['CANCELLED'] },
      scheduledStart: { lt: dayEnd },
      scheduledEnd: { gt: dayStart },
    },
    select: { scheduledStart: true, scheduledEnd: true },
  });

  const availableSlots: { start: string; end: string }[] = [];
  const stepMs = 30 * 60_000; // skok co 30 minut
  const durationMs = durationMinutes * 60_000;

  for (let time = dayStart.getTime(); time + durationMs <= dayEnd.getTime(); time += stepMs) {
    const slotStart = new Date(time);
    const slotEnd = new Date(time + durationMs);

    const hasConflict = existingOrders.some(
      (order) => order.scheduledStart < slotEnd && order.scheduledEnd > slotStart
    );

    if (!hasConflict) {
      availableSlots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      });
    }
  }

  return {
    mechanicId,
    date: dateStr,
    durationMinutes,
    availableSlots,
  };
}