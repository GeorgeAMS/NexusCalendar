# Feature 002 — Admin Users

## Objetivo

Bandeja de solicitudes y CRUD sencillo de perfiles: aprobar con rol, rechazar, cambiar rol, desactivar.

## Referencias

- Docs: journey admin, RBAC
- Contract: `/admin/users*`

## Comportamiento

1. Solo `role=admin`.
2. Aprobar exige `role` ∈ {`usuario`,`gerencia`}; pasa a `active`.
3. Rechazar → `rejected`.
4. DELETE → `disabled` (soft).
5. Cambio de rol en activos (sin promover a admin por API en v1).
6. Email de aprobación + audit.

## Acceptance Criteria

- [x] AC1: Usuario no-admin en rutas admin → 403.
- [x] AC2: `GET /admin/users?status=pending` lista solo pendientes.
- [x] AC3: `approve` con rol válido activa cuenta y setea rol.
- [x] AC4: Tras approve, el usuario puede login.
- [x] AC5: `reject` impide login con `ACCOUNT_REJECTED`.
- [x] AC6: `DELETE` deja `disabled` e impide login.
- [x] AC7: Mail de aprobación enviado (verificado en Mailhog local).
- [x] AC8: Audits `user.approved` / `user.rejected` / `user.disabled` / `user.role_changed`.

## UI placeholder

- [x] Lista pendientes con botones Aprobar (selector de rol) / Rechazar.
- [x] Lista general con desactivar y cambiar rol.

## Implementación

- API: [`apps/api/src/users/`](../../apps/api/src/users/) — `UsersService`, `AdminUsersController`, DTOs de filtros y de rol.
- Autorización: [`apps/api/src/auth/roles.guard.ts`](../../apps/api/src/auth/roles.guard.ts) + decorador `@Roles`.
- Correo: [`apps/api/src/notifications/`](../../apps/api/src/notifications/) — `MailerService` (nodemailer) y `NotificationsService`.
- Web: [`apps/web/src/views/AdminUsersView.tsx`](../../apps/web/src/views/AdminUsersView.tsx).
- Tests: [`apps/api/src/users/users.service.spec.ts`](../../apps/api/src/users/users.service.spec.ts) (11 casos).
- Smoke manual: [`scripts/smoke-admin.ps1`](../../scripts/smoke-admin.ps1).

## Decisiones

- `DELETE /admin/users/:id` responde **200 con el usuario actualizado** (no 204), para que la UI refresque el estado sin otra consulta.
- Las cuentas con rol `admin` no se pueden aprobar, rechazar, desactivar ni cambiar de rol por API: se gestionan desde el seed. Esto también evita que un admin se desactive a sí mismo.
- `approve` solo aplica a cuentas que no están `active`; para una cuenta activa se usa `PATCH /role`. Aprobar sirve además para reactivar cuentas `rejected` o `disabled`.
- `reject` limpia el rol para que el estado quede coherente (sin rol mientras no esté aprobada).
- Al desactivar se borran las `push_subscriptions` del usuario en la misma transacción (cumple por adelantado el AC6 del feature 006).
- Un fallo de SMTP se registra en log y no revierte la aprobación.
- El listado ordena por `status` ascendente, que en el enum empieza en `pending`: las solicitudes quedan arriba.
