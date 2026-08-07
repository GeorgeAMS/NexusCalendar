# Feature 006 — Invites & Notifications

## Objetivo

Notificar por email (y push si está disponible) en aprobación, invitación y override.

## Referencias

- Docs: notificaciones PWA
- Contract: efectos colaterales + `/push/subscribe`

## Comportamiento

1. Puerto de notificaciones desacoplado del dominio.
2. Local: SMTP → Mailhog.
3. Eventos v1: `account.approved`, `reservation.invite`, `reservation.overridden`, `reservation.cancelled`.
4. Push: si no hay keys/HTTPS, log + no fallar la reserva.
5. Tabla `notifications` recomendada para in-app.

## Acceptance Criteria

- [x] AC1: Aprobar usuario genera email de aprobación.
- [x] AC2: Crear reserva con invitados genera un email por destinatario.
- [x] AC3: Override genera email a organizador desplazado (y a sus invitados).
- [x] AC4: Fallo de SMTP no deja la API sin respuesta controlada (error log + decisión: ¿rollback reserva? → **v1: reserva se mantiene, se registra fallo de notificación**).
- [x] AC5: `POST /push/subscribe` persiste subscription para el user auth.
- [x] AC6: Usuario disabled pierde efecto útil de sus subscriptions (se borran al desactivar).

## UI placeholder

- [x] Banner “Activa notificaciones” no bloqueante, con el estado real del navegador.
- [x] Lista “Mis notificaciones” con contador de no leídas y marcado en bloque.

## Implementación

- El dominio publica un evento y `NotificationsService` lo reparte a tres canales:
  correo (`MailerService`), historial in-app (`InboxService`) y push (`PushService`).
  Ningún canal puede tumbar la operación de negocio: cada uno va en su propio `try/catch`.
- Los textos viven en `notifications/templates.ts` como funciones puras, sin acceso a base ni a
  configuración; reciben la `webUrl` ya resuelta. Eso los hace testeables y fáciles de mover a
  plantillas HTML más adelante.
- Push e in-app solo aplican a destinatarios con cuenta (`userId`); un invitado externo recibe
  únicamente correo.
- Destinatarios deduplicados por correo en minúscula: quien es organizador e invitado a la vez
  recibe un solo mensaje.
- Al cancelar, el organizador **no** se notifica a sí mismo; sí se le avisa si canceló gerencia.
- Web Push es opcional: sin `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` el servicio arranca con un
  aviso en el log, `GET /push/public-key` devuelve `null` y la PWA muestra que solo hay correo.
  Las subscriptions que responden 404/410 se borran solas.
- Sonido diferencial: Chrome ignora sonidos personalizados en Web Push, así que el service worker
  usa `tag` + `renotify` + patrón de vibración. El asset de audio queda para el front definitivo.

## Verificación

- Unit tests: `apps/api/src/notifications/templates.spec.ts` y `notifications.service.spec.ts`.
- Smoke manual: [`scripts/smoke-notifications.ps1`](../../scripts/smoke-notifications.ps1).
