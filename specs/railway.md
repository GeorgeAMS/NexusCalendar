# Railway Spec — despliegue producción

Topología:

```text
Railway Project: nexus-calendar
  ├─ PostgreSQL
  ├─ Service: api   (Root Directory = apps/api)
  └─ Service: web   (Root Directory = apps/web)
```

Repo recomendado: `GeorgeAMS/NexusCalendar` (o el remoto que uses).

## API (`apps/api`)

Archivo: [`apps/api/railway.toml`](../apps/api/railway.toml)

- Build: `npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && node dist/main.js`
- Healthcheck: `GET /api/v1/health`

### Variables

| Variable | Notas |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | lo inyecta Railway |
| `DATABASE_URL` | Reference Variable del plugin Postgres |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | secretos largos |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `15m` / `7d` |
| `APP_TIMEZONE` | `America/Bogota` |
| `CORS_ORIGIN` | URL HTTPS exacta del servicio `web` |
| `APP_WEB_URL` | misma URL del front |
| `SMTP_*` / `MAIL_FROM` | SMTP real (Gmail app password o Resend) |
| `ADMIN_SEED_*` | solo primer seed; rotar después |
| `VAPID_*` | opcional |

Seed una vez (Railway shell): `npx prisma db seed`

## Web (`apps/web`)

Archivo: [`apps/web/railway.toml`](../apps/web/railway.toml)

- Build: `npm run build`
- Start: `npm run start:prod` → `node .output/server/index.mjs`
- Variable de **build**: `VITE_API_URL=https://<api>.up.railway.app/api/v1`

## Orden de deploy

1. Postgres
2. api (migrate + dominio)
3. web (`VITE_API_URL` + dominio)
4. Actualizar `CORS_ORIGIN` / `APP_WEB_URL` en api → redeploy api

## Checklist

1. Repo GitHub conectado a Railway.
2. Migraciones con `prisma migrate deploy` en start.
3. Secretos solo en Variables de Railway.
4. SMTP real.
5. HTTPS (Railway).
6. Admin seed ejecutado una vez; password rotado.
