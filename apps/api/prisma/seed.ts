import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const rooms = [
  { name: 'Sala de juntas Nexus', slug: 'sala-juntas-nexus', locationNote: null },
  { name: 'Sede Violeta', slug: 'sede-violeta', locationNote: null },
  {
    name: 'Tercer piso sede hospitalaria (cafeteria)',
    slug: 'tercer-piso-cafeteria',
    locationNote: 'Cafeteria, tercer piso',
  },
];

async function seedRooms(): Promise<void> {
  for (const room of rooms) {
    await prisma.room.upsert({
      where: { slug: room.slug },
      update: { name: room.name, locationNote: room.locationNote, isActive: true },
      create: room,
    });
  }
  console.log(`Salas listas: ${rooms.length}`);
}

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    console.warn('ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD no definidos: se omite el admin.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      role: UserRole.admin,
      status: UserStatus.active,
      passwordHash,
    },
    create: {
      email,
      fullName: process.env.ADMIN_SEED_NAME ?? 'Administrador Nexus',
      phone: process.env.ADMIN_SEED_PHONE ?? '0000000000',
      role: UserRole.admin,
      status: UserStatus.active,
      approvedAt: new Date(),
      passwordHash,
    },
  });

  console.log(`Admin listo: ${email}`);
}

async function main(): Promise<void> {
  await seedRooms();
  await seedAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
