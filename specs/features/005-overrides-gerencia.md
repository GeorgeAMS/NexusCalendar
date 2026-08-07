# Feature 005 — Gerencia Override

## Objetivo

Permitir a gerencia crear una reserva sobre un horario ocupado, con confirmación, auditoría y aviso a afectados.

## Referencias

- Contract: `POST /reservations` con `force: true`
- Docs: journey gerencia, audit

## Comportamiento

1. Solo `role=gerencia` puede enviar `force=true`.
2. Usuario con `force=true` → 403 `FORBIDDEN`.
3. Si hay solapes `confirmed`:
   - pasan a `overridden`
   - `overriddenByReservationId` apunta a la nueva
4. Nueva reserva queda `confirmed`.
5. Audit `reservation.overridden` con metadata (ids desplazados).
6. Notificar organizador(es) e invitados de las desplazadas (email mínimo).
7. Anticipación de 1 día **sigue aplicando** a gerencia en v1.

## Acceptance Criteria

- [x] AC1: Gerencia `force=true` sobre slot ocupado → 201; previa `overridden`.
- [x] AC2: Usuario `force=true` → 403.
- [x] AC3: Gerencia `force=false` en conflicto → 409 (igual que usuario).
- [x] AC4: Audit contiene actor, reservation nueva y lista de overridden.
- [x] AC5: Email de override visible en Mailhog para organizador desplazado.
- [x] AC6: Slot liberado conceptualmente: nueva confirmed es la que bloquea; overridden no bloquea.

## UI placeholder

- [x] El conflicto muestra quién tiene la sala y el horario exacto.
- [x] El botón “Tomar la sala como gerencia” aparece solo cuando la API responde
      `details.canOverride: true`, es decir solo para gerencia.

## Implementación

- El override vive en el mismo `POST /reservations`: `force: true` es la única diferencia.
  Se implementó junto al feature 004 porque un endpoint no puede decidir entre conflicto y
  sobreescritura a medias.
- `ROOM_CONFLICT` incluye `details.canOverride` para que el front sepa si ofrecer el botón sin
  tener que conocer el rol.
- Solo se desplazan las reservas que **realmente** se solapan; el resto del día sigue intacto.
- El aviso por correo se envía al organizador desplazado y a sus invitados
  (`NotificationsService.reservationOverridden`); un fallo de SMTP se registra y no tumba la reserva.
- La regla del día de anticipación también aplica a gerencia en v1.

## Verificación

- Unit tests: `apps/api/src/reservations/reservations.service.spec.ts`.
- Smoke manual: `scripts/smoke-reservations.ps1`, pasos [7] y [8] + revisión en Mailhog.
