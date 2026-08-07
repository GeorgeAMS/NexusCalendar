# Feature 003 — Rooms & Calendar Read

## Objetivo

Exponer salas activas y listar reservas en un rango para pintar el calendario.

## Referencias

- Contract: `GET /rooms`, `GET /reservations`
- Docs: 3 salas seed

## Comportamiento

1. Seed crea exactamente las 3 salas con slugs documentados.
2. `GET /rooms` solo `isActive=true`.
3. `GET /reservations` filtra por `from`/`to`/`roomId`.
4. Por defecto listar `confirmed` (query puede ampliar estados).
5. Admin, usuario y gerencia activos pueden leer.

## Acceptance Criteria

- [x] AC1: Tras seed, `GET /rooms` devuelve 3 ítems con nombres correctos.
- [x] AC2: Usuario active recibe 200 en rooms y reservations.
- [x] AC3: Filtro `roomId` limita resultados.
- [x] AC4: Rango `from`/`to` excluye fechas fuera.
- [x] AC5: Sin auth → 401.

## UI placeholder

- [x] Dropdown de salas.
- [x] Vista semanal cruda de 7 días con navegación anterior / hoy / siguiente.
- [x] Indicación visual de ocupación (franja horaria, título, sala, organizador, invitados) y del día en curso.

## Implementación

- API salas: [`apps/api/src/rooms/`](../../apps/api/src/rooms/).
- API reservas (lectura): [`apps/api/src/reservations/`](../../apps/api/src/reservations/).
- Helpers de fecha con zona horaria: [`apps/api/src/common/dates.ts`](../../apps/api/src/common/dates.ts).
- Web: [`apps/web/src/views/CalendarView.tsx`](../../apps/web/src/views/CalendarView.tsx) y [`apps/web/src/calendar.ts`](../../apps/web/src/calendar.ts).
- Datos de demo: [`apps/api/prisma/seed-demo.ts`](../../apps/api/prisma/seed-demo.ts) (`npm run db:seed:demo`).
- Tests: [`reservations.service.spec.ts`](../../apps/api/src/reservations/reservations.service.spec.ts) y [`dates.spec.ts`](../../apps/api/src/common/dates.spec.ts).
- Smoke manual: [`scripts/smoke-calendar.ps1`](../../scripts/smoke-calendar.ps1).

## Decisiones

- Sin `from`/`to`, `GET /reservations` devuelve una ventana de **30 días desde hoy** en la zona horaria de la clínica, no la del servidor.
- Sin `status`, devuelve solo `confirmed`: las canceladas y sobreescritas no ocupan sala y solo sirven como historial.
- Rango invertido (`to < from`) responde 400 `VALIDATION_ERROR`.
- La respuesta aplana `roomName` y `organizerName` para que el calendario se pinte sin consultas extra.
- `admin` también puede leer salas y calendario; lo que no puede es reservar (feature 004).
- El seed de demo crea dos cuentas activas (`gerencia` y `usuario`) y cuatro reservas próximas. Es idempotente y solo para desarrollo local.
