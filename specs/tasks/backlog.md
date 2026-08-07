# Backlog de implementación (orden SDD)

Trabajar **en orden**. No saltar a Railway/GitHub hasta las tareas marcadas como futuras.

Estado: `TODO` | `DOING` | `DONE`

---

## Epic 0 — Specs (docs)

| ID | Task | Estado |
|----|------|--------|
| T0.1 | Arquitectura en `/docs` | DONE |
| T0.2 | Kit SDD en `/specs` | DONE |

---

## Epic 1 — Scaffold local

| ID | Task | Spec | Estado |
|----|------|------|--------|
| T1.1 | Crear `docker-compose.yml` (Postgres + Mailhog) | local-development | DONE |
| T1.2 | Scaffold `apps/api` NestJS + Prisma + health | technical-spec | DONE |
| T1.3 | `.env.example` API + web | technical-spec | DONE |
| T1.4 | `.gitignore` preparado para futuro GitHub | technical-spec | DONE |
| T1.5 | Migración inicial según modelo de datos | docs/03, technical-spec | DONE |
| T1.6 | Seed: 3 salas + admin | technical-spec | DONE |
| T1.7 | Scaffold `apps/web` Vite React TS placeholder | 007 | DONE |
| T1.8 | README de arranque local | local-development | DONE |

**DoD Epic 1:** `health` ok, migrate + seed ok, web abre. **Verificado**: `{"status":"ok","database":"up"}`, migración `init` aplicada, 3 salas + admin sembrados, web 200 en `localhost:5173`.

Extras entregados en este epic: filtro global de errores con los códigos del contrato (`src/common/`) y healthcheck con verificación real de base de datos.

---

## Epic 2 — Auth

| ID | Task | Spec | Estado |
|----|------|------|--------|
| T2.1 | Register + hash password | 001 | DONE |
| T2.2 | Login + JWT access/refresh | 001 | DONE |
| T2.3 | Guards JWT + `/auth/me` | 001 | DONE |
| T2.4 | Códigos ACCOUNT_* | 001 | DONE |
| T2.5 | UI placeholder login/registro/pendiente | 001, 007 | DONE |
| T2.6 | Tests mínimos auth | 001 | DONE |

**DoD Epic 2:** AC de 001 en verde. **Verificado**: 13 tests unitarios en verde (`npm test` en `apps/api`) y smoke manual con [`scripts/smoke-auth.ps1`](../../scripts/smoke-auth.ps1) devolviendo 201 / `EMAIL_TAKEN` / `ACCOUNT_PENDING` / login OK / `UNAUTHORIZED` / `VALIDATION_ERROR`.

Extra: `AuditService` global (adelanta parte de T3.5) y `AuditLog` escribiendo `user.registered`.

---

## Epic 3 — Admin users

| ID | Task | Spec | Estado |
|----|------|------|--------|
| T3.1 | Listado + filtros admin | 002 | DONE |
| T3.2 | Approve / reject / role / disable | 002 | DONE |
| T3.3 | Guard role=admin | 002 | DONE |
| T3.4 | Email aprobación → Mailhog | 002, 006 | DONE |
| T3.5 | Audit user.* | 002 | DONE |
| T3.6 | UI admin placeholder | 002, 007 | DONE |

**DoD Epic 3:** AC de 002 en verde. **Verificado**: 24 tests unitarios (`npm test` en `apps/api`) y [`scripts/smoke-admin.ps1`](../../scripts/smoke-admin.ps1) con los 11 chequeos en verde, incluido el correo de aprobación en Mailhog y los audits `user.approved` / `user.rejected` / `user.role_changed` / `user.disabled` en base.

---

## Epic 4 — Rooms + lectura calendario

| ID | Task | Spec | Estado |
|----|------|------|--------|
| T4.1 | GET /rooms | 003 | DONE |
| T4.2 | GET /reservations con filtros + detalle | 003 | DONE |
| T4.3 | UI calendario/lista cruda | 003, 007 | DONE |

**DoD Epic 4:** AC de 003 en verde. **Verificado**: 36 tests unitarios y [`scripts/smoke-calendar.ps1`](../../scripts/smoke-calendar.ps1) con 21 chequeos en verde (3 salas, filtros por sala y fecha, detalle, 401 sin token y validaciones).

Extra: helpers de fecha con zona horaria (`src/common/dates.ts`) y seed de demo (`npm run db:seed:demo`) para poblar el calendario antes de que exista el POST.

---

## Epic 5 — Reservas

| ID | Task | Spec | Estado |
|----|------|------|--------|
| T5.1 | POST reservas + validaciones | 004 | DONE |
| T5.2 | Overlap engine + ADVANCE_NOTICE | 004 | DONE |
| T5.3 | Invitees persist | 004, 006 | DONE |
| T5.4 | DELETE cancel | 004 | DONE |
| T5.5 | UI form reserva | 004, 007 | DONE |
| T5.6 | Tests overlap/anticipación | 004 | DONE |

**DoD Epic 5:** AC de 004 en verde. **Verificado**: 53 tests unitarios (`npm test` en `apps/api`) y [`scripts/smoke-reservations.ps1`](../../scripts/smoke-reservations.ps1) con 44 chequeos en verde (creación, solape total/parcial/contenedor, horario contiguo permitido, anticipación, admin sin permiso, cancelación y liberación del horario).

---

## Epic 6 — Override gerencia

| ID | Task | Spec | Estado |
|----|------|------|--------|
| T6.1 | force=true path | 005 | DONE |
| T6.2 | Mark overridden + link | 005 | DONE |
| T6.3 | Audit + emails override | 005, 006 | DONE |
| T6.4 | UI confirmación override | 005, 007 | DONE |
| T6.5 | Tests gerencia vs usuario | 005 | DONE |

**DoD Epic 6:** AC de 005 en verde. **Verificado**: mismo smoke, pasos [7] y [8]; la reserva desplazada queda `overridden`, el audit `reservation.overridden` guarda los ids y en Mailhog llegan los avisos al organizador y sus invitados.

Se implementó junto al Epic 5: `POST /reservations` es el mismo endpoint y no puede resolver el
conflicto a medias. El front decide si mostrar el botón de sobreescribir con `details.canOverride`.

---

## Epic 7 — Notificaciones / push

| ID | Task | Spec | Estado |
|----|------|------|--------|
| T7.1 | NotificationPort + plantillas email | 006 | DONE |
| T7.2 | Invite emails en create | 006 | DONE |
| T7.3 | push subscribe (+ stub OK) | 006 | DONE |
| T7.4 | Tabla notifications opcional | 006 | DONE |

**DoD Epic 7:** AC de 006 (email) en verde; push best-effort. **Verificado**: 68 tests unitarios (`npm test` en `apps/api`) y [`scripts/smoke-notifications.ps1`](../../scripts/smoke-notifications.ps1) con 51 chequeos en verde: correos de invitación, override y cancelación en Mailhog, buzón in-app con contador y marcado, subscripción de push idempotente y borrado de subscriptions al desactivar la cuenta.

Extras: `notifications/templates.ts` con los textos como funciones puras, service worker mínimo en
`apps/web/public/sw.js` para recibir el push, y `npm run push:keys` para generar el par VAPID
cuando se quiera probar push real (sin claves el canal queda deshabilitado y solo va correo).

---

## Epic 8 — Futuro (NO ahora)

| ID | Task | Estado |
|----|------|--------|
| T8.1 | Crear repositorio GitHub | TODO (después) |
| T8.2 | Conectar Railway api + Postgres | TODO (después) |
| T8.3 | Frontend PWA en `apps/web` (TanStack Start) | DONE (desacoplado; falta GitHub/Railway) |
| T8.4 | CORS_ORIGIN a URL del front en producción | TODO (después) |
| T8.5 | SMTP/VAPID producción | TODO (después) |

---

## Próxima acción concreta

Cuando digas **arrancar código**, empezar por **T1.1 → T1.8** (Epic 1) siguiendo constitution + technical-spec.
