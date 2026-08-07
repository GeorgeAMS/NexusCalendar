# Technical Spec — Local first, Railway-ready

## Objetivo técnico

Entregar un monorepo local con API NestJS + PostgreSQL + frontend PWA React, estructurado para desplegar después en **Railway** sin tocar el dominio al cambiar el UI.

## Estructura de repo (a crear en implementación)

```text
NexusCalendar/
  apps/
    api/                 # NestJS — fuente de verdad del negocio
    web/                 # PWA TanStack Start (cliente del API contract)
  packages/              # opcional: tipos compartidos del API contract
  docs/                  # Arquitectura (ya existe)
  specs/                 # SDD (este árbol)
  docker-compose.yml     # PostgreSQL (+ Mailhog opcional)
  README.md
  .env.example           # Sin secretos reales
```

Hasta tener GitHub: trabajar en carpeta local; `.gitignore` preparado desde el primer commit futuro.

## Stack

| Pieza | Elección | Versión instalada |
|-------|----------|-------------------|
| Runtime | Node.js | 24.15 (dev local); Railway usará 22 LTS |
| API | NestJS + TypeScript | 11.x |
| ORM | Prisma | 6.19 |
| DB | PostgreSQL | 16 (contenedor) |
| Auth | JWT access + refresh | httpOnly refresh opcional en fase posterior; v1: bearer |
| Validación | class-validator / Zod | Una sola en API |
| Web | React 19 + Vite 6 + TS | Placeholder |
| Hash de password | bcryptjs | Sin compilación nativa en Windows |
| Email local | Mailhog | Dev |
| Push | web-push + VAPID | Stub si no hay HTTPS local (ver notas) |

## Variables de entorno

### API (`apps/api`)

| Variable | Local | Railway (futuro) |
|----------|-------|------------------|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | inyectado |
| `DATABASE_URL` | docker postgres en `localhost:5433` | Railway Postgres plugin |
| `JWT_ACCESS_SECRET` | local secret | Railway secret |
| `JWT_REFRESH_SECRET` | local secret | Railway secret |
| `JWT_ACCESS_TTL` | `15m` | `15m` |
| `JWT_REFRESH_TTL` | `7d` | `7d` |
| `APP_TIMEZONE` | `America/Bogota` | igual |
| `CORS_ORIGIN` | `http://localhost:5173` | URL del front |
| `SMTP_HOST` / `PORT` / `USER` / `PASS` | Mailhog | proveedor real |
| `MAIL_FROM` | `nexus@localhost` | dominio clínica |
| `APP_WEB_URL` | `http://localhost:5173` (si falta se usa el primer `CORS_ORIGIN`) | URL del front |
| `VAPID_PUBLIC_KEY` | opcional, `npm run push:keys` | secret |
| `VAPID_PRIVATE_KEY` | opcional, `npm run push:keys` | secret |
| `VAPID_SUBJECT` | `mailto:admin@local` | contacto real |
| `ADMIN_SEED_EMAIL` | obligatorio local | secret |
| `ADMIN_SEED_PASSWORD` | obligatorio local | secret |

### Web (`apps/web`)

| Variable | Valor local |
|----------|-------------|
| `VITE_API_URL` | `http://localhost:3000/api/v1` |

## Contenedores locales

`docker-compose.yml` mínimo:

- `postgres:16` — publicado en `5433` del host (el `5432` local suele estar tomado por una instalación previa de PostgreSQL), volumen persistente.
- `mailhog` — UI `8025`, SMTP `1025`.

La API y el web corren en el host con Node (hot reload). No hace falta containerizar Nest/Vite en v1 local.

## Capas en la API

```text
Controller → DTO validation → Guard (JWT/RBAC)
  → Service (casos de uso)
    → Prisma / repositorio
    → NotificationPort (email/push)
    → AuditPort
```

- Sin lógica de solapes en controllers.
- `ReservationsService` concentra anticipación, overlap y override.
- `NotificationsService` es el puerto único: los servicios de dominio publican un evento y él
  reparte a `MailerService` (SMTP), `InboxService` (tabla `notifications`) y `PushService` (VAPID).
  Los textos son funciones puras en `notifications/templates.ts`.

## Migraciones y seed

- Prisma Migrate como única vía de schema.
- Seed idempotente:
  1. Tres salas (slugs fijos del modelo de datos).
  2. Usuario `admin` con email/password de env.
- Re-ejecutar seed no duplica salas ni admin.

## CORS y cookies

- v1 local: Authorization Bearer desde el cliente web (localStorage aceptable en v1).
- Preferir mismo origen o CORS explícito; refresh token strategy revisable en v1.1.

## HTTPS y Push en local

- Web Push real exige HTTPS; `localhost` cuenta como contexto seguro, así que en escritorio
  funciona sin certificados. En el celular hace falta la URL de Railway.
- Implementado: `POST /push/subscribe` + service worker en `apps/web/public/push-sw.js`.
- Sin claves VAPID el canal se deshabilita solo (log de aviso, `publicKey: null`) y las reservas
  siguen funcionando con correo.

## Criterios Railway-ready (sin desplegar)

1. Arranque con `DATABASE_URL` y `PORT` de entorno.
2. Sin paths absolutos de máquina local.
3. Migrations en release command futuro: `prisma migrate deploy`.
4. Un servicio API; front estático en servicio aparte o CDN después.
5. Healthcheck: `GET /api/v1/health` → `{ "status": "ok" }`.

## Testing mínimo por fase

| Fase | Debe existir |
|------|--------------|
| Auth | Test de registro pending + login rechazado |
| Reservas | Test unitario/integración de overlap y anticipación |
| Override | Test gerencia force vs usuario 403 |

No exigir E2E completo antes del placeholder estable.

## Naming

- DB: `snake_case` en columnas Prisma `@map`.
- JSON API: `camelCase`.
- Enums API: mismos strings que en docs (`pending`, `gerencia`, …).

## Decisión: horas como `HH:mm`

`start_time` y `end_time` se almacenan como `varchar(5)` en formato 24h con cero a la izquierda, no como `time`.

Motivo: el orden lexicográfico coincide con el cronológico, así que la detección de solapes es una comparación directa (`start < :newEnd AND end > :newStart`), se serializa tal cual en JSON y se evita la conversión a `Date` en UTC que Prisma impone sobre `@db.Time`.

El invariante `endTime > startTime` se valida en el servicio y en el DTO.
