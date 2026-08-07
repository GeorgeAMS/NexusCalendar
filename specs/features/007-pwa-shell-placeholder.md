# Feature 007 — PWA Shell

## Objetivo

Cliente web PWA en `apps/web` alineado al contrato API. Evoluciona el shell mínimo
de demos locales hacia la UI definitiva (TanStack Start).

## Principios

- Cero acoplamiento del dominio a un design system de terceros.
- Config solo por `VITE_API_URL`.
- No lógica de overlap en el cliente (solo mostrar errores del API).

## Pantallas mínimas

1. Login  
2. Registro  
3. Pendiente de aprobación  
4. Calendario / lista de reservas  
5. Nueva reserva  
6. Admin usuarios  
7. Ajustes (logout; push opcional)

## Acceptance Criteria

- [x] AC1: App arranca en `localhost:5173` y habla con la API.
- [x] AC2: Flujos felices de features 001–005 ejecutables desde UI.
- [x] AC3: README documenta el front en `apps/web`.
- [x] AC4: Ningún secreto de API embebido; solo URL pública.
- [x] AC5: Estructura de llamadas alineada a [api-contract.md](../api-contract.md).

El logout vive en la vista de inicio y el permiso de notificaciones en “Mis notificaciones”.
El service worker de `public/push-sw.js` es lo mínimo para recibir push; el shell PWA
incluye manifest e iconos.

## Referencia de producto

1. Brief: [`frontend-brief.md`](../frontend-brief.md)
2. Contrato API: [`api-contract.md`](../api-contract.md)
3. Matriz RBAC: [`docs/05`](../../docs/05-permisos-flujos.md)
4. Journeys: [`docs/02`](../../docs/02-journey-maps.md)
5. `VITE_API_URL` / base URL del entorno
