# 06 — Notificaciones y PWA

## Objetivos

1. Avisar cuando una cuenta es aprobada.
2. Avisar a invitados de una nueva reunión.
3. Avisar a organizador e invitados cuando gerencia sobreescribe una reserva.
4. Usar un **sonido distintivo** de Nexus Calendar en el push (cuando el sistema operativo lo permita).
5. Mantener **email como fallback** fiable.

## Canales

| Canal | Uso | Obligatorio en v1 |
|-------|-----|-------------------|
| Email | Aprobación, invitaciones, override | Sí |
| Web Push | Mismos eventos si hay subscription | Sí (best effort) |
| In-app (`notifications`) | Historial / badge | Recomendado |

## Eventos

| Evento | Destinatarios | Email | Push | In-app |
|--------|---------------|-------|------|--------|
| `account.approved` | Solicitante | Sí | Si hay sub | Sí |
| `reservation.invite` | Cada invitado | Sí | Si user+sub | Sí si user |
| `reservation.overridden` | Organizador previo + invitados | Sí | Sí | Sí |
| `reservation.cancelled` | Invitados (+ organizador si aplica) | Sí | Sí | Sí |

## Web Push (PWA)

### Requisitos técnicos

- Sitio servido por **HTTPS**.
- Service Worker registrado.
- Claves **VAPID** en el servidor.
- Usuario acepta permiso de notificaciones en el navegador.
- Subscription guardada en `push_subscriptions`.

### Flujo de alta

1. Usuario autenticado abre Ajustes o un prompt post-login.
2. La PWA pide `Notification.permission`.
3. Si concede, crea `PushSubscription` y la envía a `POST /push/subscribe`.
4. El backend asocia la subscription al `user_id`.

### Sonido diferencial

- Incluir asset de audio propio (ej. `nexus-notify.mp3` / `.caf` según plataforma) en la PWA.
- En el payload de la notificación, referenciar el sonido custom cuando el cliente lo soporte.
- **Limitación:** no todos los navegadores/OS respetan sonido custom en Web Push (especialmente políticas de iOS). El email y el título/cuerpo “Nexus Calendar” mitigan la identificación del origen.
- **Implementado en v1:** el service worker usa `tag` + `renotify` y un patrón de vibración propio.
  Chrome ignora el sonido personalizado, así que el asset de audio se define con el front definitivo.

### Payload conceptual

```json
{
  "title": "Nexus Calendar",
  "body": "Nueva reunión: Comité calidad — 08/08 10:00",
  "data": {
    "type": "reservation.invite",
    "reservationId": "uuid"
  },
  "tag": "reservation-uuid",
  "renotify": true
}
```

`tag` evita apilar duplicados del mismo evento.

## Email

Plantillas mínimas:

1. **Cuenta aprobada** — rol asignado + CTA login.
2. **Invitación a reunión** — sala, fecha, hora, título, organizador.
3. **Reunión desplazada / sobreescrita** — explicación + nueva realidad de la sala (quién la tomó, horario).

Remitente preferible del dominio institucional si está disponible.

## Límites y realidad móvil

| Plataforma | Notas |
|------------|-------|
| Android Chrome | Mejor soporte PWA + Web Push |
| Desktop Chrome/Edge | Buen soporte |
| iOS Safari | Requiere añadir a pantalla de inicio; Web Push con restricciones de versión/OS; sonido custom limitado |

**Estrategia:** nunca depender solo del push. Email siempre. In-app si el usuario abre la app.

## PWA — capacidades v1

- Manifest: nombre “Nexus Calendar”, iconos, `display: standalone`.
- Service worker: precache del shell; network-first o stale-while-revalidate para API de calendario según se implemente.
- Instalable desde el navegador del celular.
- Prompt de notificaciones después del primer login exitoso (no en el primer paint agresivo).

## Privacidad

- No enviar en el push datos clínicos sensibles; solo metadatos de reunión (título, sala, hora).
- Endpoints de push asociados al usuario autenticado.
- Al desactivar usuario, invalidar/borrar sus `push_subscriptions`.

## Pruebas manuales recomendadas

1. Registrar subscription en Android Chrome y recibir invite.
2. Override gerencia → organizador recibe email + push.
3. Usuario sin permiso de notificación → solo email.
4. iOS: documentar resultado real del dispositivo de prueba de la clínica.
