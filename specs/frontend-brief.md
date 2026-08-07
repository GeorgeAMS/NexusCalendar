# Brief frontend — Nexus Calendar

Referencia de producto y contrato para el cliente web en `apps/web`.
Complementa con `api-contract.md` como fuente de verdad de shapes JSON.

---

## Qué es

**Nexus Calendar** es una PWA para reservar salas de reuniones de la **Clínica Regional del San Jorge**.

El **backend ya existe** (NestJS + PostgreSQL). El frontend consume ese API. No inventa endpoints, reglas de solape ni roles: el servidor ya los valida.

## Stack del front

- React + TypeScript + TanStack Start / Vite.
- Variable de entorno: `VITE_API_URL` (local: `http://localhost:3000/api/v1`).
- Auth: `Authorization: Bearer <accessToken>`.
- Guarda `accessToken` y `refreshToken` (localStorage o equivalente).
- **No** recalcules solapes ni anticipación en el cliente: muestra los errores del API.

## Roles y pantallas

| Rol | Puede |
|-----|--------|
| Público | Registro, login |
| `pending` | Solo pantalla “espera aprobación” |
| `usuario` | Calendario, crear reserva en horario libre, cancelar propia, invitados, notificaciones |
| `gerencia` | Todo lo de usuario + sobreescribir sala ocupada (`force: true`) + cancelar ajenas |
| `admin` | Gestionar usuarios (aprobar/rechazar/rol/desactivar) + ver calendario; **no** crea reservas en v1 |

### Pantallas mínimas

1. **Login**
2. **Registro** (nombre, correo institucional, teléfono, contraseña)
3. **Pendiente de aprobación**
4. **Calendario / ocupación** (por sala y fechas)
5. **Nueva reserva** (fecha, entrada, salida, título, descripción opcional, sala, invitados)
6. **Confirmación de override** (solo gerencia, cuando el API responda `ROOM_CONFLICT` con `canOverride: true`)
7. **Admin — usuarios** (bandeja pending + activos)
8. **Mis notificaciones** + activar push (opcional)
9. **Logout**

## Reglas de negocio (UI debe respetarlas)

1. Reservas con **mínimo 1 día de anticipación** (zona `America/Bogota`). El date picker puede usar `min = mañana`.
2. Horas `HH:mm`; la salida debe ser posterior a la entrada.
3. Si hay conflicto → mostrar mensaje del API y, si `details.canOverride`, ofrecer “Tomar la sala como gerencia”.
4. Invitados: lista de correos (coma / salto de línea). El API deduplica.
5. Errores siempre con forma `{ statusCode, code, message, details }`. Usa `message` en UI; usa `code` para branching.

## Endpoints que debe consumir

Base: `{VITE_API_URL}` = `http://localhost:3000/api/v1` (local).

### Públicos
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`

### Auth (Bearer)
- `POST /auth/refresh` — body `{ refreshToken }`
- `GET /auth/me`

### Admin (solo `role=admin`)
- `GET /admin/users?status=&role=&q=&page=&pageSize=`
- `PATCH /admin/users/:id/approve` — `{ "role": "usuario" | "gerencia" }`
- `PATCH /admin/users/:id/reject`
- `PATCH /admin/users/:id/role` — `{ "role": "..." }`
- `DELETE /admin/users/:id`

### Salas y reservas
- `GET /rooms`
- `GET /reservations?from=&to=&roomId=&status=`
- `GET /reservations/:id`
- `POST /reservations` — body create (+ `force?: boolean`)
- `DELETE /reservations/:id`

### Notificaciones / push
- `GET /notifications?unread=&limit=`
- `POST /notifications/read` — `{ ids?: string[] }`
- `GET /push/public-key`
- `POST /push/subscribe` — `{ endpoint, keys: { p256dh, auth } }`
- `DELETE /push/subscribe` — `{ endpoint }`

**Contrato detallado:** [`api-contract.md`](api-contract.md).

## Códigos de error importantes en UI

| code | Qué mostrar / hacer |
|------|---------------------|
| `ACCOUNT_PENDING` | Ir a pantalla pendiente |
| `ACCOUNT_REJECTED` / `ACCOUNT_DISABLED` | Mensaje claro, no entrar |
| `EMAIL_TAKEN` | Correo ya registrado |
| `ROOM_CONFLICT` | Mostrar conflictos; si `canOverride`, botón de gerencia |
| `ADVANCE_NOTICE` | Pedir fecha ≥ mañana (`details.earliestDate`) |
| `VALIDATION_ERROR` | Campos inválidos |
| `FORBIDDEN` | Sin permiso |
| `UNAUTHORIZED` | Cerrar sesión / pedir login |

## Salas iniciales (seed)

1. Sala de juntas Nexus  
2. Sede Violeta  
3. Tercer piso sede hospitalaria (cafetería)

## Cuentas demo (solo local)

Tras `npm run db:seed` + `npm run db:seed:demo` en la API:

| Email | Password | Rol |
|-------|----------|-----|
| `admin@nexus.local` | `Admin123*` | admin |
| `gerente.demo@clinica.example` | `Demo123*` | gerencia |
| `usuario.demo@clinica.example` | `Demo123*` | usuario |

## Diseño

Marca: **Nexus Calendar** / Clínica Regional del San Jorge.

- Profesional clínico, limpio, confiable.
- Prioridad móvil (PWA).
- Tipografía expresiva (evitar Inter/Roboto/Arial por defecto).
- Override de gerencia con confirmación explícita.
- Admin: bandeja de pendientes primero.

## Qué NO hacer

- No reimplementar reglas de solape ni anticipación en el cliente.
- No crear CRUD de salas (vienen del seed).
- No inventar endpoints ni cambiar nombres de campos del contrato.
- No pedir datos clínicos sensibles en notificaciones (solo título, sala, hora).
- No asumir que el admin puede crear reservas.

## Cómo conectar en local

1. API: `http://localhost:3000/api/v1`.
2. En `apps/web/.env`: `VITE_API_URL=http://localhost:3000/api/v1`.
3. `CORS_ORIGIN` en la API debe incluir el origen del front (`http://localhost:5173`).
