/**
 * Datos de demostracion para desarrollo local: dos cuentas activas y algunas
 * reservas en los proximos dias. Es idempotente y no debe ejecutarse en produccion.
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { addDays, parseDateOnly, todayInTimezone } from '../src/common/dates';

const prisma = new PrismaClient();

const TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Bogota';
const DEMO_PASSWORD = 'Demo123*';

const demoUsers = [
  {
    email: 'gerente.demo@clinica.example',
    fullName: 'Gabriela Gerente',
    phone: '3001112233',
    role: UserRole.gerencia,
  },
  {
    email: 'usuario.demo@clinica.example',
    fullName: 'Ulises Usuario',
    phone: '3004445566',
    role: UserRole.usuario,
  },
];

async function upsertDemoUsers(): Promise<Record<string, string>> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const ids: Record<string, string> = {};

  for (const demo of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: { role: demo.role, status: UserStatus.active, passwordHash },
      create: {
        ...demo,
        status: UserStatus.active,
        approvedAt: new Date(),
        passwordHash,
      },
    });
    ids[demo.role] = user.id;
  }

  console.log(`Cuentas demo listas (password ${DEMO_PASSWORD}): ${demoUsers.length}`);

  return ids;
}

async function seedReservations(organizers: Record<string, string>): Promise<void> {
  const rooms = await prisma.room.findMany({ orderBy: { slug: 'asc' } });
  if (rooms.length === 0) {
    console.warn('No hay salas: ejecuta primero el seed principal.');
    return;
  }

  const bySlug = new Map(rooms.map((room) => [room.slug, room.id]));
  const today = todayInTimezone(TIMEZONE);

  const drafts = [
    {
      slug: 'sala-juntas-nexus',
      meetingDate: addDays(today, 1),
      startTime: '08:00',
      endTime: '09:30',
      title: 'Comite de calidad',
      description: 'Revision de indicadores del mes.',
      organizerId: organizers[UserRole.usuario],
      invitees: ['gerente.demo@clinica.example', 'jefatura@clinica.example'],
    },
    {
      slug: 'sala-juntas-nexus',
      meetingDate: addDays(today, 1),
      startTime: '10:00',
      endTime: '11:00',
      title: 'Reunion de gerencia',
      description: null,
      organizerId: organizers[UserRole.gerencia],
      invitees: ['usuario.demo@clinica.example'],
    },
    {
      slug: 'sede-violeta',
      meetingDate: addDays(today, 2),
      startTime: '14:00',
      endTime: '15:00',
      title: 'Induccion de personal nuevo',
      description: null,
      organizerId: organizers[UserRole.usuario],
      invitees: [],
    },
    {
      slug: 'tercer-piso-cafeteria',
      meetingDate: addDays(today, 4),
      startTime: '09:00',
      endTime: '10:00',
      title: 'Capacitacion de seguridad del paciente',
      description: 'Traer carne institucional.',
      organizerId: organizers[UserRole.gerencia],
      invitees: ['usuario.demo@clinica.example'],
    },
  ];

  let created = 0;

  for (const draft of drafts) {
    const roomId = bySlug.get(draft.slug);
    if (!roomId || !draft.organizerId) {
      continue;
    }

    const meetingDate = parseDateOnly(draft.meetingDate);

    const existing = await prisma.reservation.findFirst({
      where: { roomId, meetingDate, startTime: draft.startTime },
    });

    if (existing) {
      continue;
    }

    await prisma.reservation.create({
      data: {
        roomId,
        organizerId: draft.organizerId,
        title: draft.title,
        description: draft.description,
        meetingDate,
        startTime: draft.startTime,
        endTime: draft.endTime,
        invitees: {
          create: draft.invitees.map((email) => ({ email })),
        },
      },
    });

    created += 1;
  }

  console.log(`Reservas demo creadas: ${created} (existentes se conservan)`);
}

async function main(): Promise<void> {
  const organizers = await upsertDemoUsers();
  await seedReservations(organizers);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
