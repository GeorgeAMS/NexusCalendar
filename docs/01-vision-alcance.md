# 01 — Visión y alcance

## Producto

**Nexus Calendar** es una Progressive Web App (PWA) interna para reservar las salas de reuniones de la **Clínica Regional del San Jorge**. Facilita ver ocupación, reservar con anticipación e invitar participantes, con reglas distintas según el rol.

Es un proyecto de práctica del área de sistemas.

## Problema que resuelve

Hoy la coordinación de salas depende de canales informales (p. ej. WhatsApp). No hay una vista única de ocupación ni un flujo claro de quién puede desalojar una reserva. Nexus Calendar centraliza calendario, reservas, invitaciones y control de acceso por roles.

## Alcance v1

- Registro de interesados mediante formulario (sin autoasignación de rol).
- Aprobación y asignación de roles por administrador.
- Login según estado de cuenta y rol.
- Calendario de salas (ocupadas / próximas).
- Reserva de salas con fecha, hora inicio/fin, nombre, descripción opcional e invitados por correo.
- Notificación push (PWA) y correo a invitados.
- Regla de **un día de anticipación** para nuevas reservas.
- Tres salas iniciales en catálogo.
- Override de ocupación solo para **gerencia**, con auditoría y aviso a afectados.
- Admin: aprobar, asignar rol, listar y borrar/desactivar perfiles.

## Fuera de alcance v1 (candidato a v1.1+)

- Recordatorios automáticos previos a la reunión.
- Aceptar/rechazar invitación de forma explícita en la app.
- CRUD completo de salas desde admin (en v1 van por seed).
- Integración con Google Calendar / Outlook.
- App nativa (solo PWA).
- Multi-clínica o multi-tenant.

## Roles

| Rol | Código | Descripción |
|-----|--------|-------------|
| Administrador | `admin` | Aprueba solicitudes, asigna roles, desactiva/borra perfiles. |
| Gerencia | `gerencia` | Reserva y puede sobreescribir salas ya ocupadas. |
| Usuario general | `usuario` | Reserva solo horarios libres. |

El rol **no** lo elige el solicitante. Queda vacío o nulo mientras la cuenta está pendiente; el admin lo asigna al aprobar.

## Estados de cuenta

| Estado | Código | Efecto |
|--------|--------|--------|
| Pendiente | `pending` | Registrado; sin acceso al calendario. |
| Activo | `active` | Puede iniciar sesión según su rol. |
| Rechazado | `rejected` | Sin acceso. |
| Desactivado | `disabled` | Soft-delete / baja; sin acceso. |

## Salas iniciales

1. **Sala de juntas Nexus**
2. **Sede Violeta**
3. **Tercer piso sede hospitalaria (cafetería)**

Se modelan como registros de catálogo (`rooms`), no como valores fijos en código de negocio a largo plazo.

## Reglas de negocio principales

1. **Anticipación:** la fecha de la reunión debe ser al menos **mañana** (día calendario en zona horaria de la clínica, `America/Bogota`). Aplica a todos los roles en v1.
2. **Conflicto de horario:** dos reservas en la misma sala se solapan si comparten fecha y sus intervalos `[inicio, fin)` se cruzan.
3. **Usuario general:** no puede crear una reserva que solape otra `confirmed`.
4. **Gerencia:** puede forzar la reserva; las anteriores en conflicto pasan a `overridden` (o canceladas por override), se audita y se notifica.
5. **Campos de reserva:** fecha, hora entrada, hora salida, nombre (obligatorio), descripción (opcional), sala, lista de correos invitados.
6. **Campos de registro:** nombre, correo institucional, teléfono.
7. **Invitaciones:** al crear la reserva, los invitados reciben correo y push (si tienen PWA con permisos) y ven el evento en su calendario Nexus.

## Canales de entrada

El onboarding arranca fuera del sistema (grupo de WhatsApp con personas de interés). El enlace lleva al formulario de registro de Nexus Calendar. WhatsApp no es parte del producto; solo es el canal de difusión.

## Principios de diseño de producto

- Móvil primero (PWA instalable).
- Una acción primaria clara por pantalla.
- Calendario como ancla operativa.
- Fallbacks por correo cuando el push no esté disponible (sobre todo iOS).
