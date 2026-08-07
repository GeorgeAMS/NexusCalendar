# Local Development Spec

## Premisas

- Todo corre en la máquina del desarrollador.
- No hay GitHub ni Railway en esta fase.
- PostgreSQL y Mailhog vía Docker Compose.
- Front = PWA en `apps/web` (TanStack Start) contra el contrato API.

## Prerequisitos de máquina

- Node.js 20+ (verificado con 24.15)
- npm (verificado con 11.12)
- Docker Desktop con el daemon iniciado
- Git (opcional hasta crear repo)

## Servicios locales

| Servicio | URL / puerto |
|----------|----------------|
| API | http://localhost:3000 |
| API prefix | http://localhost:3000/api/v1 |
| Web (PWA) | http://localhost:5173 (o el puerto que asigne Vite) |
| PostgreSQL | localhost:**5433** |
| Mailhog UI | http://localhost:8025 |
| Mailhog SMTP | localhost:1025 |

PostgreSQL se publica en **5433** porque el 5432 del host ya está ocupado por una instalación local de PostgreSQL ajena al proyecto.

## Arranque

Desde la raíz del repo:

```bash
docker compose up -d
```

Instalación (una vez):

```bash
npm run install:all
```

API:

```bash
cd apps/api
copy .env.example .env      # PowerShell: Copy-Item .env.example .env
npx prisma migrate dev
npm run db:seed
npm run db:seed:demo        # opcional: cuentas y reservas de ejemplo
npm run start:dev
```

Web:

```bash
cd apps/web
copy .env.example .env
npm run dev
```

Atajos desde la raíz: `npm run api:dev`, `npm run web:dev`, `npm run db:seed`, `npm run infra:up`, `npm run infra:down`.

## Datos seed esperados

Seed principal (`npm run db:seed`):

- Salas: Sala de juntas Nexus, Sede Violeta, Tercer piso sede hospitalaria (cafetería).
- Admin: credenciales de `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` del `.env`.

Seed de demo (`npm run db:seed:demo`, solo desarrollo):

| Cuenta | Rol | Password |
|--------|-----|----------|
| `gerente.demo@clinica.example` | gerencia | `Demo123*` |
| `usuario.demo@clinica.example` | usuario | `Demo123*` |

Más cuatro reservas en los próximos días para poder ver el calendario con datos.

Ambos seeds son idempotentes (upsert por `slug` / `email`; las reservas se saltan si ya existe una en la misma sala, fecha y hora de inicio).

## Checklist "local OK"

- [x] `docker compose ps` muestra `nexus-postgres` healthy y `nexus-mailhog` up.
- [x] `prisma migrate dev` aplica la migración inicial.
- [x] `npm run db:seed` crea 3 salas + admin.
- [x] `GET http://localhost:3000/api/v1/health` → `{"status":"ok","database":"up"}`.
- [x] `http://localhost:5173` responde 200 y muestra el estado de la API.
- [x] Registro → `pending`.
- [x] Login pending → `ACCOUNT_PENDING`.
- [x] Login del admin del seed → tokens + `/auth/me`.
- [x] Admin aprueba con rol → login del solicitante OK.
- [x] Mailhog recibe el correo de aprobación.
- [x] `GET /rooms` devuelve las 3 salas y el calendario muestra la ocupación.
- [x] Crear una reserva para mañana desde el calendario y verla en la lista.
- [x] Intentar el mismo horario en la misma sala → mensaje de conflicto.
- [x] Con la cuenta de gerencia, sobreescribir ese horario y ver el correo en Mailhog.
- [x] Cancelar una reserva propia y volver a reservar ese horario.
- [x] Crear una reserva con invitados y ver un correo por invitado en Mailhog.
- [x] Ver el aviso en “Mis notificaciones” con el contador de no leídas.
- [ ] Push real en el celular: requiere claves VAPID (`npm run push:keys`) y HTTPS o `localhost`.

## Verificación automatizada

```bash
cd apps/api
npm test                                    # tests unitarios

cd ../..
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-auth.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-admin.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-calendar.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-reservations.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-notifications.ps1
```

Los scripts recorren los criterios de aceptación de los features 001 a 006 contra la API en ejecución y no imprimen tokens. `smoke-admin.ps1` además consulta la API de Mailhog para confirmar el correo de aprobación. `smoke-reservations.ps1` trabaja sobre una fecha a 20 días y cancela todo lo que crea, así que se puede repetir sin ensuciar el calendario. `smoke-notifications.ps1` **vacía el buzón de Mailhog** al empezar para poder contar correos, así que no lo corras si querías conservar los mensajes anteriores. Todos terminan con código de salida distinto de cero si algún chequeo falla.

## Notificaciones push (opcional)

Sin claves VAPID el push queda deshabilitado: la API lo avisa en el log, `GET /push/public-key`
devuelve `null` y solo se envía correo. Para probarlo de verdad:

```bash
cd apps/api
npm run push:keys        # imprime el par de claves
```

Pega el par en `apps/api/.env` (`VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`), reinicia la API y usa el
botón **Activar notificaciones** de la web. `localhost` cuenta como contexto seguro, así que
funciona en el navegador de escritorio sin HTTPS; en el celular hace falta HTTPS (Railway).

Las claves son credenciales: van en `.env`, nunca en `.env.example` ni en el repositorio.

## Problemas conocidos

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `P1000 Authentication failed` en 5432 | PostgreSQL local del sistema responde antes que el contenedor | Usar el 5433 del `docker-compose.yml` (ya configurado) |
| `failed to connect to the docker API` | Docker Desktop cerrado | Abrir Docker Desktop y reintentar |
| Aviso `package.json#prisma is deprecated` | Prisma 7 moverá la config del seed | Migrar a `prisma.config.ts` cuando se suba a Prisma 7 |

## Secretos

- `.env` local no versionado (`.gitignore` ya lo cubre).
- `.env.example` sin passwords reales.

## Windows notes

- Raíz del proyecto: `C:\NexusCalendar`.
- Docker requiere backend WSL2.
- La zona horaria de negocio es `America/Bogota` en código, independiente del OS.
