# Gap analysis — Frontend vs API / brief

Fecha: 2026-08-06. Fuente: PWA en `apps/web` (TanStack Start), desacoplada de tooling de terceros.

## Qué hay (completo)

| Área | Estado |
|------|--------|
| Login / registro / pendiente | OK |
| Calendario mes + día/semana, filtro salas | OK |
| Nueva reserva + modal override (`force`) | OK |
| Admin usuarios (approve/reject/role/disable) | OK |
| Notificaciones + push opcional | OK |
| Cliente API + refresh JWT | OK |
| Zona `America/Bogota` para “mañana” | OK |
| RBAC UI (admin no reserva; gerencia override solo con `canOverride`) | OK |
| PWA manifest + iconos + `push-sw.js` (sin cache offline) | OK |
| Identidad visual (azul/naranja, Sora, Three.js en auth) | OK |
| Build producción (`npm run build`) | OK |

## Qué se corrigió al integrar

| Gap | Acción |
|-----|--------|
| Tras registro / `ACCOUNT_PENDING` no hay tokens; “Verificar estado” llamaba `/auth/me` | Corregido en `pendiente.tsx`: sin sesión → ir a login |
| Mensajes explícitos `ACCOUNT_REJECTED` / `ACCOUNT_DISABLED` en login | Corregido en `index.tsx` |

## Qué sigue pendiente (no bloquea v1)

| Gap | Notas |
|-----|--------|
| Restaurar estado “push ya activado” al recargar | `notificaciones` arranca en idle |
| `GET /health` en UI | Opcional |
| `GET /reservations/:id` en detalle | Usa payload del listado; suele bastar |
| Historial cancelled/overridden | Fuera del brief v1 |
| Auditoría de overrides para admin | No hay endpoint en el contrato aún |
| GitHub + Railway + CORS producción | Epic 8 |

## Cómo arrancar

```bash
docker compose up -d
npm run install:all
npm run db:migrate
npm run db:seed
npm run db:seed:demo
npm run api:dev
npm run web:dev
```

`VITE_API_URL=http://localhost:3000/api/v1` en `apps/web/.env`.
`CORS_ORIGIN` en la API debe incluir el origen del front.
