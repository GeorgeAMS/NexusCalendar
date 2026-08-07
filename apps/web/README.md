# Nexus Calendar — Web (PWA)

Frontend PWA (TanStack Start + React Query). Consume la API NestJS;
**no** recalcula solapes ni roles en el cliente.

## Arranque

```bash
# desde la raíz del monorepo
npm run install:all
npm run api:dev          # otra terminal
npm run web:dev          # http://localhost:5173
```

Variables:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

En la API, `CORS_ORIGIN` debe incluir el origen del front (p. ej. `http://localhost:5173`).

## Rutas

| Ruta | Quién |
|------|--------|
| `/` | Login |
| `/registro` | Solicitud de acceso |
| `/pendiente` | Cuenta no activa |
| `/calendario` | Activos |
| `/reservas/nueva` | `usuario` / `gerencia` |
| `/admin/usuarios` | `admin` |
| `/notificaciones` | Activos |

## Cuentas demo

Tras `npm run db:seed` + `npm run db:seed:demo` en `apps/api`:

| Email | Password | Rol |
|-------|----------|-----|
| `admin@nexus.local` | `Admin123*` | admin |
| `gerente.demo@clinica.example` | `Demo123*` | gerencia |
| `usuario.demo@clinica.example` | `Demo123*` | usuario |

## Contrato

Fuente de verdad: [`../../specs/api-contract.md`](../../specs/api-contract.md).
Brief de diseño: [`../../specs/frontend-brief.md`](../../specs/frontend-brief.md).
