# Constitution — Nexus Calendar

Principios no negociables. Toda feature, PR futuro y decisión técnica debe respetarlos.

## 1. API-first

- El **contrato HTTP** ([api-contract.md](api-contract.md)) es el artefacto estable.
- El frontend en `apps/web` consume ese contrato; no inventa reglas de negocio.
- No se inventan endpoints “por comodidad del UI”.
- Breaking changes del API requieren versión o migración documentada.

## 2. Roles y estados son ley

- Nadie se autoasigna rol.
- Sin `status = active` + `role` asignado → no hay acceso al calendario ni a reservas.
- Solo `gerencia` puede override con confirmación explícita (`force: true`).
- `admin` gestiona personas; en v1 no hace override ni crea reservas (consulta calendario sí).

## 3. Reglas de reserva

- Anticipación mínima: **1 día calendario** (`America/Bogota`).
- Solape en misma sala + misma fecha + intervalos cruzados → conflicto.
- Intervalo semiabierto `[start, end)`: borde exacto permitido.
- Override deja traza en `audit_logs` y notifica afectados.

## 4. Datos y privacidad

- Correo institucional como identidad.
- Soft-delete de usuarios (`disabled`); no borrar historial de reservas a ciegas.
- Push y email sin datos clínicos sensibles; solo metadatos de reunión.

## 5. Entorno y despliegue

- **Ahora:** solo local.
- **Después:** GitHub, luego Railway.
- Diseñar para Railway desde el día 1 (env vars, un proceso API, PostgreSQL gestionado) sin desplegar aún.
- No commitear secretos (`.env` fuera de git cuando exista repo).

## 6. Calidad mínima

- Validación de entrada en API (DTO / schema).
- Errores de negocio con códigos estables (`ACCOUNT_PENDING`, `ROOM_CONFLICT`, …).
- Cada feature spec tiene **Acceptance Criteria** verificables.
- Migraciones de DB versionadas; seed reproducible (3 salas + admin).

## 7. Notificaciones

- Email es fallback obligatorio.
- Web Push es best-effort (PWA); no bloquear el flujo si falla el push.
- Sonido/branding Nexus cuando el cliente lo permita.

## 8. Anti-patrones (prohibido)

- Lógica de negocio solo en el frontend.
- Hardcodear las 3 salas en el cliente como única fuente de verdad.
- Permitir override sin confirmación o sin auditoría.
- Acoplar el dominio a un design system o framework de UI de terceros.
- Desplegar a producción sin variables de entorno documentadas.

## 9. Idioma

- Código y nombres de API: **inglés** (`fullName`, `meetingDate`).
- Copy de UI y docs de negocio orientadas a la clínica: **español**.
- Mensajes de error de API: código en inglés + `message` en español cuando sea para UI.
