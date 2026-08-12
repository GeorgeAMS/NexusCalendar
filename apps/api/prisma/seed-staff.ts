/**
 * Alta idempotente de cuentas institucionales (activas) con password generica.
 * Uso: railway run --service api -- npx ts-node --transpile-only prisma/seed-staff.ts
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Misma familia que Admin123* / Demo123* */
const GENERIC_PASSWORD = 'Nexus123*';

const staff = [
  {
    email: 'auditoria@clinicaregionaldelsanjorge.com',
    fullName: 'Auditoría',
    role: UserRole.usuario,
  },
  {
    email: 'gerencia@clinicaregionaldelsanjorge.com',
    fullName: 'Gerencia',
    role: UserRole.gerencia,
  },
  {
    email: 'germangustavo_5@hotmail.com',
    fullName: 'German Gustavo',
    role: UserRole.gerencia,
  },
  {
    email: 'administracion@clinicaregionaldelsanjorge.com',
    fullName: 'Administración',
    role: UserRole.usuario,
  },
  {
    email: 'talentohumano@clinicaregionaldelsanjorge.com',
    fullName: 'Talento Humano',
    role: UserRole.usuario,
  },
  {
    email: 'gestioncalidad@clinicaregionaldelsanjorge.com',
    fullName: 'Gestión de Calidad',
    role: UserRole.usuario,
  },
  {
    email: 'compras@clinicaregionaldelsanjorge.com',
    fullName: 'Compras',
    role: UserRole.usuario,
  },
  {
    email: 'sst@clinicaregionaldelsanjorge.com',
    fullName: 'SST',
    role: UserRole.usuario,
  },
  {
    email: 'sistemas@clinicaregionaldelsanjorge.com',
    fullName: 'Sistemas',
    role: UserRole.usuario,
  },
  {
    email: 'contabilidad@clinicaregionaldelsanjorge.co',
    fullName: 'Contabilidad',
    role: UserRole.usuario,
  },
  {
    email: 'epstic@gmail.com',
    fullName: 'Epstic',
    role: UserRole.usuario,
  },
] as const;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(GENERIC_PASSWORD, 10);

  for (const person of staff) {
    const email = person.email.toLowerCase();
    await prisma.user.upsert({
      where: { email },
      update: {
        fullName: person.fullName,
        role: person.role,
        status: UserStatus.active,
        passwordHash,
        approvedAt: new Date(),
      },
      create: {
        email,
        fullName: person.fullName,
        phone: '0000000000',
        role: person.role,
        status: UserStatus.active,
        approvedAt: new Date(),
        passwordHash,
      },
    });
    console.log(`OK ${email} (${person.role})`);
  }

  console.log(`\nListo: ${staff.length} usuarios. Password generica: ${GENERIC_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
