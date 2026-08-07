# Nexus Calendar

PWA para reservar salas de reuniones de la **Clínica Regional del San Jorge**.

Proyecto de práctica — área de sistemas.

## Estado

| Capa | Estado |
|------|--------|
| Arquitectura (`/docs`) | Aprobada |
| Spec-Driven Development (`/specs`) | Listo |
| Epic 1 — Scaffold local | Completo (API + DB + web) |
| Epic 2 — Auth | Completo (registro, login JWT, `/auth/me`) |
| Epic 3 — Admin de usuarios | Completo (roles, aprobación, correo, auditoría) |
| Epic 4 — Salas y calendario | Completo (salas, lectura de reservas, vista semanal) |
| Epic 5 — Crear y cancelar reservas | Completo (anticipación, solapes, invitados, cancelación) |
| Epic 6 — Override de gerencia | Completo (`force`, desplazadas a `overridden`, aviso por correo) |
| Epic 7 — Notificaciones e invitaciones | Completo (correo, buzón in-app, push opcional) |
| GitHub | Pendiente |
| Railway | Pendiente (spec listo) |
| Frontend PWA | Integrado en `apps/web` (TanStack Start) |

## Arranque local

```bash
docker compose up -d
npm run install:all
npm run db:migrate
npm run db:seed
npm run db:seed:demo   # opcional: cuentas y reservas de ejemplo
npm run api:dev        # http://localhost:3000/api/v1
npm run web:dev        # http://localhost:5173
```

Detalle y troubleshooting: [`specs/local-development.md`](specs/local-development.md).

## Estructura

```text
apps/api    NestJS + Prisma + PostgreSQL (fuente de verdad del negocio)
apps/web    PWA (TanStack Start) contra el contrato API
docs/       Arquitectura de producto
specs/      Spec-Driven Development
scripts/    Smoke tests manuales contra la API
```

## Graphify (contexto para Cursor)

El proyecto tiene un grafo de código en `graphify-out/` y la regla
`.cursor/rules/graphify.mdc` (siempre activa).

```bash
graphify update .                 # reconstruir grafo (solo AST, sin API key)
graphify query "tu pregunta"      # subgrafo acotado
graphify path "A" "B"             # camino entre conceptos
```

Sin clave LLM basta el modo AST. Con `GEMINI_API_KEY` (u otra) puedes hacer
`graphify extract .` para extracción semántica más rica.

## Cómo trabajar (SDD)

1. Leer [`specs/constitution.md`](specs/constitution.md)
2. Seguir el orden de [`specs/tasks/backlog.md`](specs/tasks/backlog.md)
3. Cumplir Acceptance Criteria del feature spec correspondiente
4. El **API contract** es la interfaz estable para el cliente web

Índice SDD: [`specs/README.md`](specs/README.md)

## Arquitectura (producto)

| Doc | Contenido |
|-----|-----------|
| [01 — Visión y alcance](docs/01-vision-alcance.md) | Producto, roles, salas, reglas |
| [02 — Journey maps](docs/02-journey-maps.md) | Flujos por rol |
| [03 — Modelo de datos](docs/03-modelo-datos.md) | Tablas y relaciones |
| [04 — Arquitectura](docs/04-arquitectura.md) | Capas y stack |
| [05 — Permisos y flujos](docs/05-permisos-flujos.md) | RBAC |
| [06 — Notificaciones y PWA](docs/06-notificaciones-pwa.md) | Push / email |
| [07 — Roadmap](docs/07-roadmap.md) | Fases |

## Specs (ejecución)

| Spec | Contenido |
|------|-----------|
| [Constitution](specs/constitution.md) | Invariantes |
| [Product](specs/product-spec.md) | Alcance v1 |
| [Technical](specs/technical-spec.md) | Stack, monorepo, env |
| [API Contract](specs/api-contract.md) | REST para API + cliente web |
| [Brief frontend](specs/frontend-brief.md) | Pantallas, roles y reglas de UI |
| [Gap frontend](specs/frontend-gap-analysis.md) | Qué tiene el front y qué falta vs API |
| [Local](specs/local-development.md) | Arranque local |
| [Railway](specs/railway.md) | Deploy futuro |
| [Features 001–007](specs/features/) | Criterios de aceptación |
| [Backlog](specs/tasks/backlog.md) | Orden de tareas |

## Roles (resumen)

- **Admin** — aprueba, asigna roles, gestiona perfiles.
- **Gerencia** — reserva y puede sobreescribir.
- **Usuario** — reserva solo horarios libres.

## Verificación

```bash
cd apps/api && npm test
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-auth.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-admin.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-calendar.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-reservations.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-notifications.ps1
```

## Próximo paso

Backend + frontend PWA ya viven en el monorepo. Sigue el **Epic 8**: repositorio en
GitHub, Railway (api + Postgres + SMTP/VAPID) y `CORS_ORIGIN` apuntando al origen del front
([spec railway](specs/railway.md)).
