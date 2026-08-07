# Feature 004 — Create & Cancel Reservations

## Objetivo

Crear reservas con validación de anticipación y solapes; cancelar según permisos.

## Referencias

- Contract: `POST /reservations`, `DELETE /reservations/:id`
- Docs: reglas de negocio, modelo

## Comportamiento

1. Campos: roomId, title, description?, meetingDate, startTime, endTime, inviteeEmails[].
2. `endTime > startTime`.
3. `meetingDate >= tomorrow` en `America/Bogota` → si no, `ADVANCE_NOTICE`.
4. Solo una `confirmed` por franja horaria en toda la clínica (cualquier sala) →
   `ROOM_CONFLICT` si `force` false.
5. Organizador = usuario autenticado.
6. Invitados: emails normalizados, dedupe, link a user si existe.
7. Cancel: organizador (propia) o gerencia (cualquiera) → `cancelled`.

## Acceptance Criteria

- [x] AC1: Reserva válida en slot libre → 201 `confirmed`.
- [x] AC2: Horario solapado (misma u otra sala), force false → 409 `ROOM_CONFLICT`.
- [x] AC3: Reserva para hoy o pasado → 422 `ADVANCE_NOTICE`.
- [x] AC4: `endTime <= startTime` → 400 `VALIDATION_ERROR`.
- [x] AC5: Admin no puede crear reserva (403) en v1.
- [x] AC6: Organizador cancela propia → status `cancelled`; ya no genera conflicto.
- [x] AC7: Usuario no puede cancelar ajena → 403.
- [x] AC8: InviteeEmails duplicados se guardan una sola vez.
- [x] AC9: Audit `reservation.created` / `reservation.cancelled`.

## UI placeholder

- [x] Formulario de reserva dentro del calendario (`apps/web/src/views/ReservationForm.tsx`).
- [x] Mensaje de conflicto legible desde `details.conflicts`.
- [x] Botón de cancelar en cada reserva propia (o cualquiera si el rol es gerencia).

## Implementación

- Lógica en `apps/api/src/reservations/reservations.service.ts` (`create`, `cancel`).
- Solape con **intervalo semiabierto**: `startTime < endTimeExistente && endTime > startTimeExistente`.
  Una reunión puede empezar exactamente cuando termina otra (09:00–10:00 tras 08:00–09:00).
- Solo choca contra reservas `confirmed`: las `cancelled` y `overridden` liberan la sala.
- La anticipación se calcula con `earliestBookableDate('America/Bogota')`, no con la hora del servidor.
- Creación y override ocurren en una sola transacción de Prisma para que la sala nunca quede en
  un estado intermedio.
- `POST` y `DELETE` están limitados con `@Roles(usuario, gerencia)`: el admin gestiona cuentas, no salas.
- Cancelar una reserva que ya no está `confirmed` devuelve `VALIDATION_ERROR` (no se cancela dos veces).
- Los correos de invitación llegan en el Epic 7; hoy los invitados solo se persisten.

## Verificación

- Unit tests: `apps/api/src/reservations/reservations.service.spec.ts`.
- Smoke manual: `scripts/smoke-reservations.ps1` (cubre también el feature 005).
