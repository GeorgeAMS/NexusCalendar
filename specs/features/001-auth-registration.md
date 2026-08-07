# Feature 001 — Auth & Registration

## Objetivo

Permitir registro público de interesados y autenticación solo de cuentas `active` con rol asignado.

## Referencias

- Docs: visión, journey registro
- Contract: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`

## Comportamiento

1. Registro crea usuario `status=pending`, `role=null`, password hasheado.
2. Email único; duplicado → `EMAIL_TAKEN`.
3. Login con pending/rejected/disabled → códigos específicos, sin token.
4. Login con active → access + refresh + user.
5. `/auth/me` exige Bearer válido.

## Fuera de alcance

- OAuth / magic link.
- Verificación de email por código.
- Auto-aprobación.

## Acceptance Criteria

- [x] AC1: `POST /auth/register` con datos válidos responde 201 y persiste `pending`.
- [x] AC2: Segundo registro con mismo email responde 409 `EMAIL_TAKEN`.
- [x] AC3: Login de usuario pending responde 403 `ACCOUNT_PENDING`.
- [x] AC4: Login de cuenta `active` responde 200 con tokens y `role` (verificado con el admin del seed; la aprobación desde UI es feature 002).
- [x] AC5: `/auth/me` sin token → 401; con token → perfil correcto.
- [x] AC6: Password nunca se devuelve en JSON.
- [x] AC7: Audit `user.registered` al registrarse.

## UI placeholder (mínimo)

- [x] Formulario registro (nombre, email, teléfono, password).
- [x] Pantalla “Tu solicitud está en revisión”.
- [x] Formulario login + mensaje de error según `code`.
- [x] Sesión persistida en `localStorage` y rehidratada con `/auth/me`.

## Implementación

- API: [`apps/api/src/auth/`](../../apps/api/src/auth/) — servicio, controlador, DTOs, `JwtAuthGuard`, decorador `@CurrentUser`.
- Auditoría: [`apps/api/src/audit/`](../../apps/api/src/audit/).
- Tipos y mapeo de usuario: [`apps/api/src/users/user.types.ts`](../../apps/api/src/users/user.types.ts).
- Tests: [`apps/api/src/auth/auth.service.spec.ts`](../../apps/api/src/auth/auth.service.spec.ts) (13 casos, `npm test`).
- Smoke manual: [`scripts/smoke-auth.ps1`](../../scripts/smoke-auth.ps1).

## Decisiones

- Refresh token **stateless**: se firma con `JWT_REFRESH_SECRET` y claim `type: "refresh"`; no se persiste en base. Cada refresh revalida estado y rol del usuario contra la base.
- Cuenta `active` sin rol asignado también responde `ACCOUNT_PENDING`.
- Hash con `bcryptjs` (10 rondas) para evitar compilación nativa en Windows.
- El guard recarga el usuario desde base en cada request, así una baja o cambio de rol surte efecto sin esperar la expiración del token.
