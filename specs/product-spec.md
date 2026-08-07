# Product Spec — Nexus Calendar v1

## Problema

La Clínica Regional del San Jorge coordina salas de forma informal. Falta una vista única de ocupación, un flujo de alta controlado por sistemas y reglas claras entre personal general y gerencia.

## Solución

PWA + API para:

1. Registrar interesados (solicitud).
2. Que admin asigne rol y active la cuenta.
3. Ver calendario de salas.
4. Reservar con 1 día de anticipación e invitados por email.
5. Que gerencia pueda sobreescribir ocupación con aviso a afectados.

## Usuarios

| Persona | Necesidad |
|---------|-----------|
| Interesado | Pedir acceso con nombre, correo, teléfono |
| Admin (sistemas) | Aprobar, roles, baja de perfiles |
| Usuario general | Reservar libres, invitar |
| Gerencia | Reservar y forzar si hace falta |

## Alcance v1 (MUST)

- Registro → `pending` → aprobación con rol `usuario` | `gerencia`.
- Login JWT solo si `active`.
- 3 salas en catálogo (seed).
- CRUD operativo de reservas (crear, listar, detalle, cancelar).
- Override gerencia + auditoría + notificación.
- Invitaciones por email.
- Frontend PWA local en `apps/web`.
- Diseño listo para Railway (sin desplegar aún).

## Alcance v1 (SHOULD)

- Historial in-app de notificaciones.
- Web Push + sonido distintivo (según soporte del dispositivo).
- Filtro de calendario por sala y rango de fechas.

## Fuera de alcance v1 (WONT)

- App nativa.
- Integración Google/Outlook.
- CRUD salas desde UI (seed basta).
- Multi-tenant.
- GitHub Actions / CI hasta tener repo.
- Despliegue Railway en esta fase local.

## Métricas de éxito (cualitativas)

- Un piloto entiende “pendiente → aprobado → reservar” sin capacitación larga.
- Usuario no puede pisar reservas.
- Gerencia puede pisar y el desplazado se entera (email como mínimo).
- El cliente web conecta al API contract sin reescribir el backend.

## Dependencias externas (fase local)

| Dependencia | Fase local | Notas |
|-------------|------------|-------|
| PostgreSQL | Docker o local | Obligatorio |
| SMTP / Ethereal / Mailhog | Dev | Capturar mails sin SMTP real |
| Web Push | Opcional en local | Puede stubearse |
| WhatsApp | Fuera del sistema | Solo difusión del enlace |

## Frontend: política

- El front vive en `apps/web` y consume solo el [api-contract.md](api-contract.md).
- `VITE_API_URL` / base URL; mismos DTOs del contrato.
- No lógica de solapes ni anticipación en el cliente.
