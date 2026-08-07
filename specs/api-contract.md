# API Contract — `/api/v1`

Contrato estable para **NestJS** y el cliente web PWA.  
Base URL local: `http://localhost:3000/api/v1`.

Convenciones:

- JSON, UTF-8, `Content-Type: application/json`.
- Auth: header `Authorization: Bearer <accessToken>`.
- Fechas: `meetingDate` = `YYYY-MM-DD`; horas = `HH:mm` (24h, zona lógica Bogotá).
- Errores:

```json
{
  "statusCode": 409,
  "code": "ROOM_CONFLICT",
  "message": "La sala ya está reservada en ese horario.",
  "details": {}
}
```

---

## Códigos de error estables

| code | HTTP | Cuándo |
|------|------|--------|
| `VALIDATION_ERROR` | 400 | Body/query inválido |
| `UNAUTHORIZED` | 401 | Token ausente/inválido |
| `FORBIDDEN` | 403 | Rol insuficiente |
| `ACCOUNT_PENDING` | 403 | Login o acceso con pending |
| `ACCOUNT_REJECTED` | 403 | Cuenta rechazada |
| `ACCOUNT_DISABLED` | 403 | Cuenta desactivada |
| `EMAIL_TAKEN` | 409 | Registro duplicado |
| `ROOM_CONFLICT` | 409 | Ya hay una reunión en ese horario (cualquier sala), sin force |
| `ADVANCE_NOTICE` | 422 | Sin 1 día de anticipación |
| `NOT_FOUND` | 404 | Recurso inexistente |

---

## Health

### `GET /health`

Público.

**200**

```json
{ "status": "ok" }
```

---

## Auth

### `POST /auth/register`

Público.

**Body**

```json
{
  "fullName": "Ana Pérez",
  "email": "ana@clinica.example",
  "phone": "3001234567",
  "password": "secretoSeguro1"
}
```

**201**

```json
{
  "id": "uuid",
  "fullName": "Ana Pérez",
  "email": "ana@clinica.example",
  "phone": "3001234567",
  "status": "pending",
  "role": null,
  "createdAt": "ISO-8601"
}
```

### `POST /auth/login`

Público.

**Body**

```json
{
  "email": "ana@clinica.example",
  "password": "secretoSeguro1"
}
```

**200** (solo `status=active`)

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "id": "uuid",
    "fullName": "Ana Pérez",
    "email": "ana@clinica.example",
    "role": "usuario",
    "status": "active"
  }
}
```

### `POST /auth/refresh`

**Body:** `{ "refreshToken": "jwt" }`  
**200:** `{ "accessToken": "jwt", "refreshToken": "jwt" }`

### `GET /auth/me`

Auth requerido.

**200:** objeto `user` completo (id, fullName, email, phone, role, status, approvedAt).

---

## Users — Directorio (invitar)

### `GET /users/directory`

Auth requerido. Roles: `usuario` | `gerencia` | `admin`.

Query: `q?` (nombre/email), `limit?` (1–50, default 20).

Solo usuarios `active`. Respuesta reducida (sin teléfono ni status).

**200**

```json
{
  "items": [
    { "id": "uuid", "fullName": "Ana Pérez", "email": "ana@clinica.example" }
  ]
}
```

Uso: selector de invitados al crear reservas. El create sigue enviando `inviteeEmails`; el backend enlaza `userId` si el correo coincide con un activo.

---

## Admin — Users

Todas requieren `role=admin`.

### `GET /admin/users`

Query: `status?`, `role?`, `q?` (busca nombre/email), `page?`, `pageSize?`.

**200**

```json
{
  "items": [ { "id": "uuid", "fullName": "...", "email": "...", "phone": "...", "role": "usuario", "status": "pending", "createdAt": "..." } ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

### `PATCH /admin/users/:id/approve`

**Body:** `{ "role": "usuario" | "gerencia" }`  
**200:** user actualizado (`active` + role).  
Efectos: email + audit `user.approved`.

### `PATCH /admin/users/:id/reject`

**200:** `status=rejected`. Audit `user.rejected`.

### `PATCH /admin/users/:id/role`

**Body:** `{ "role": "usuario" | "gerencia" }`  
**Decisión v1:** solo `usuario` | `gerencia` por este endpoint; `admin` solo por seed. Requiere que la cuenta esté `active`.

### `DELETE /admin/users/:id`

Soft-delete → `disabled`. Audit `user.disabled`. Borra las `push_subscriptions` del usuario.  
**200** con el usuario actualizado.

### Cuentas de administrador

Los cuatro endpoints anteriores responden **403 `FORBIDDEN`** si el usuario objetivo tiene rol `admin`. Se gestionan desde el seed.

---

## Rooms

### `GET /rooms`

Auth: cualquier rol activo (incluido `admin`). Devuelve solo salas con `isActive = true`, ordenadas por nombre.

**200**

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Sala de juntas Nexus",
      "slug": "sala-juntas-nexus",
      "locationNote": null,
      "isActive": true
    }
  ]
}
```

---

## Reservations

Auth: `usuario` | `gerencia` (escritura); `admin` lectura en list/get.

### `GET /reservations`

Query: `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `roomId`, `status`.

Defaults implementados:

- Sin `from`: hoy en la zona horaria de la clínica (`APP_TIMEZONE`).
- Sin `to`: `from` + 30 días.
- Sin `status`: solo `confirmed`. Para historial se pide `status=cancelled` o `status=overridden`.
- `to < from` → 400 `VALIDATION_ERROR`.

**200**

```json
{
  "items": [
    {
      "id": "uuid",
      "roomId": "uuid",
      "roomName": "Sala de juntas Nexus",
      "organizerId": "uuid",
      "organizerName": "Ana Pérez",
      "title": "Comité",
      "description": null,
      "meetingDate": "2026-08-08",
      "startTime": "10:00",
      "endTime": "11:00",
      "status": "confirmed",
      "invitees": [
        { "email": "b@clinica.example", "userId": null, "inviteStatus": "accepted" }
      ],
      "createdAt": "ISO-8601"
    }
  ]
}
```

### `GET /reservations/:id`

Detalle igual al ítem anterior. **404** si no existe.

### `POST /reservations`

Roles: `usuario`, `gerencia`.

**Body**

```json
{
  "roomId": "uuid",
  "title": "Comité calidad",
  "description": "Opcional",
  "meetingDate": "2026-08-08",
  "startTime": "10:00",
  "endTime": "11:00",
  "inviteeEmails": ["b@clinica.example"],
  "force": false
}
```

Reglas implementadas:

- `admin` no crea reservas → 403 `FORBIDDEN`.
- `endTime > startTime` → si no, 400 `VALIDATION_ERROR`.
- `meetingDate >= mañana` en `APP_TIMEZONE` → si no, 422 `ADVANCE_NOTICE` con
  `details.earliestDate`.
- Sala inexistente o inactiva → 404 `NOT_FOUND`.
- `inviteeEmails`: máximo 50, se normalizan a minúscula y se deduplican; si el correo pertenece a
  un usuario activo queda enlazado a su cuenta.
- **Una sola reunión por franja horaria** en toda la clínica: solape contra cualquier
  `confirmed` del mismo día (cualquier sala), intervalo **semiabierto**
  (09:00–10:00 es válido justo después de 08:00–09:00).
- Solape + `force=false` → 409 `ROOM_CONFLICT`.
- `force=true` solo `gerencia`; cualquier otro rol → 403 `FORBIDDEN`.
- `force=true` en gerencia: la nueva queda `confirmed`, las desplazadas pasan a `overridden` con
  `overriddenByReservationId` apuntando a la nueva, y sus organizadores e invitados reciben correo.

**409** `ROOM_CONFLICT`

```json
{
  "statusCode": 409,
  "code": "ROOM_CONFLICT",
  "message": "Ya hay una reunion de 08:00 a 09:00 (Sala A) a cargo de Ana Pérez. No puede haber otra a la misma hora.",
  "details": {
    "conflicts": [
      {
        "id": "uuid",
        "title": "Comité calidad",
        "startTime": "08:00",
        "endTime": "09:00",
        "roomName": "Sala A",
        "organizerName": "Ana Pérez"
      }
    ],
    "canOverride": false
  }
}
```

`canOverride` le dice al front si ofrecer el botón de sobreescribir sin tener que razonar sobre roles.

**201:** reserva creada (mismo shape que GET).

Efectos: cada invitado recibe correo de invitación (y push + buzón in-app si tiene cuenta). En un
override, el organizador desplazado y sus invitados reciben el aviso correspondiente.

### `DELETE /reservations/:id`

Roles: `usuario`, `gerencia`.

- Organizador: puede cancelar la propia `confirmed`.
- Gerencia: puede cancelar cualquiera `confirmed`.
- Otro usuario, o `admin` → 403 `FORBIDDEN`.
- Reserva que ya no está `confirmed` → 400 `VALIDATION_ERROR`.
- Pasa a `cancelled` y libera el horario.
- Efectos: los invitados reciben aviso de cancelación; el organizador también, salvo que la
  cancelación haya sido suya.

**204**

---

## Push (opcional en local)

### `GET /push/public-key`

Auth. Devuelve la clave VAPID que la PWA necesita para suscribirse.

**200:** `{ "publicKey": "BNc..." }` — `null` cuando el entorno no tiene push configurado.

### `POST /push/subscribe`

Auth.

**Body:** subscription Web Push estándar (`endpoint`, `keys.p256dh`, `keys.auth`).

**201:** `{ "id": "uuid" }`

Idempotente por `endpoint`: repetir la llamada reasigna la subscription al usuario actual y
devuelve el mismo id.

### `DELETE /push/subscribe`

**Body:** `{ "endpoint": "..." }` → **204**. Solo borra subscriptions del usuario autenticado y no
falla si ya no existe. Desactivar una cuenta borra todas sus subscriptions.

---

## Notifications (historial in-app)

Auth: cualquier rol activo. Cada usuario solo ve su propio buzón.

### `GET /notifications`

Query: `unread=true` (solo no leídas), `limit` (1–100, por defecto 30).

**200**

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "reservation.invite",
      "title": "Nueva reunion en tu calendario",
      "body": "Comité calidad · Sala de juntas Nexus · viernes 7 de agosto de 2026, 10:00 a 11:00",
      "payload": { "reservationId": "uuid" },
      "readAt": null,
      "createdAt": "ISO-8601"
    }
  ],
  "unread": 3
}
```

`type` es uno de `account.approved`, `reservation.invite`, `reservation.overridden`,
`reservation.cancelled`. Los avisos se ordenan del más nuevo al más viejo.

### `POST /notifications/read`

**Body:** `{ "ids": ["uuid"] }` — sin `ids` marca todo el buzón como leído.

**200:** `{ "updated": 3 }`

---

## Tipos TypeScript de referencia (para el cliente web / packages)

```ts
export type UserRole = "admin" | "gerencia" | "usuario";
export type UserStatus = "pending" | "active" | "rejected" | "disabled";
export type ReservationStatus = "confirmed" | "cancelled" | "overridden";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole | null;
  status: UserStatus;
}
```

Cualquier cliente debe tipar contra este contrato, no contra el DOM del UI.
