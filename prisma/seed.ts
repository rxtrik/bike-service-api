import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const mechanic = await prisma.user.upsert({
    where: { email: 'mechanik@serwis.pl' },
    update: {},
    create: {
      email: 'mechanik@serwis.pl',
      passwordHash: 'hashed_secret_123',
      fullName: 'Marek Kowalski',
      role: Role.MECHANIC,
    },
  });

  const client = await prisma.user.upsert({
    where: { email: 'klient@rower.pl' },
    update: {},
    create: {
      email: 'klient@rower.pl',
      passwordHash: 'hashed_secret_123',
      fullName: 'Jan Nowak',
      role: Role.CLIENT,
      bikes: {
        create: {
          brand: 'Canyon',
          model: 'Inflite CF SL 6',
          frameNumber: 'R09401H22B0145',
          year: 2025,
        },
      },
    },
  });

  await prisma.serviceType.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Czyszczenie i woskowanie napędu',
        description: 'Odtłuszczenie łańcucha i kasety oraz aplikacja wosku na gorąco',
        estimatedMinutes: 60,
        basePrice: 120.0,
      },
      {
        name: 'Odpowietrzanie hamulców hydraulicznych (komplet)',
        description: 'Wymiana oleju mineralnego i odpowietrzenie obu zacisków',
        estimatedMinutes: 45,
        basePrice: 140.0,
      },
      {
        name: 'Przegląd przedsezonowy',
        description: 'Regulacja przerzutek, hamulców, kontrola naciągu szprych i łożysk',
        estimatedMinutes: 90,
        basePrice: 220.0,
      },
    ],
  });

  await prisma.part.createMany({
    skipDuplicates: true,
    data: [
      {
        sku: 'KMC-X11-SL',
        name: 'Łańcuch KMC X11 11-rzędowy',
        brand: 'KMC',
        stockQuantity: 5,
        unitPrice: 135.0,
      },
      {
        sku: 'SHIM-L05A-RF',
        name: 'Klocki hamulcowe żywiczne Shimano L05A z radiatorem',
        brand: 'Shimano',
        stockQuantity: 8,
        unitPrice: 79.0,
      },
      {
        sku: 'SHIM-OT-SP41',
        name: 'Linka i pancerz przerzutki Shimano Optislick',
        brand: 'Shimano',
        stockQuantity: 12,
        unitPrice: 45.0,
      },
    ],
  });

  console.log('Baza zasilona:', { mechanic: mechanic.email, client: client.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });