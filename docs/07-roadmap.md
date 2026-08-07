# 07 — Roadmap

## Fase 0 — Arquitectura y acuerdos

- [x] Visión y alcance
- [x] Journey maps por rol
- [x] Modelo de datos y relaciones
- [x] Arquitectura y stack
- [x] Permisos y flujos
- [x] Notificaciones / PWA
- [x] Spec-Driven Development en `/specs`
- [x] Visto bueno de arquitectura

**Salida:** `/docs` + `/specs` listos. Sin código de producto aún.

Detalle operativo: [`specs/tasks/backlog.md`](../specs/tasks/backlog.md).

---

## Fase 1 — Fundación técnica (local)

- Scaffold web (React + TanStack Start) y API (NestJS).
- PostgreSQL local (Docker) + migraciones según modelo de datos.
- Seed: 3 salas + usuario admin inicial.
- Auth: registro `pending`, login solo `active`.
- Guards RBAC básicos.
- Sin GitHub ni Railway todavía.

**Salida:** se puede registrar, aprobar, hacer login en local.

---

## Fase 2 — Admin de personas

- Bandeja de solicitudes `pending`.
- Aprobar con rol `gerencia` | `usuario`.
- Rechazar / desactivar.
- Listado y cambio de rol.
- Email de cuenta aprobada.
- Auditoría de acciones de usuario.

**Salida:** onboarding completo vía WhatsApp → formulario → admin → login.

---

## Fase 3 — Calendario y reservas

- Listado de salas.
- Vista calendario por sala/fecha.
- Crear reserva (anticipación 1 día, sin solapes).
- Cancelar propia.
- Invitados por email (persistencia + email).
- Override gerencia + notificaciones + auditoría.

**Salida:** flujo operativo usable en la clínica.

Estado: completa.

---

## Fase 4 — PWA y push

- Manifest + service worker + instalación.
- Web Push VAPID + sonido/branding Nexus.
- Pantalla de permisos / ajustes.
- Tabla `notifications` in-app (si no se hizo antes).
- Pruebas en Android e iOS de la clínica.

**Salida:** app instalable en celulares con avisos.

---

## Fase 5 — Endurecimiento y entrega de práctica

- Rate limits, validación dominio correo (si aplica).
- Backups y variables de entorno documentadas.
- Guía de uso corta para admin y usuarios.
- Checklist UAT con gerencia y un grupo piloto.
- Ajustes de copy y horarios laborales si la clínica los define.

**Salida:** entrega estable del proyecto de práctica.

---

## Backlog v1.1+

- Recordatorio push 15–30 min antes.
- Aceptar / declinar invitación explícitamente.
- CRUD de salas desde admin.
- Admin con capacidades de reserva (si se requiere).
- Excepción de anticipación para gerencia (solo si se aprueba).
- Integración Google/Outlook Calendar.
- Política de cancelación con ventana mínima.
- Reportes simples de uso por sala.

---

## Criterios de éxito v1

1. Un interesado se registra y no entra hasta que admin asigna rol.
2. Un usuario general no puede pisar una reserva.
3. Gerencia puede pisar con confirmación y el afectado se entera.
4. Las 3 salas aparecen y se reservan con 1 día de anticipación.
5. La PWA se abre de forma usable en celular.
6. Hay rastro en auditoría de overrides y cambios de rol.
