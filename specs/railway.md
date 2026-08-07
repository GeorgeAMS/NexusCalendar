# Railway Spec (futuro — no ejecutar aún)

Documento de preparación. **No desplegar** hasta tener repo GitHub y visto bueno.

## Topología objetivo

```text
Railway Project: nexus-calendar
  ├─ Service: api          (NestJS)
  ├─ Plugin:  PostgreSQL
  └─ Service: web          (build TanStack Start / Vite + Nitro)
```

Railway puede hospedar **api + postgres + web**, o solo api+postgres si el front vive en otro host.

## Variables en Railway (api)

Reutilizar las de [technical-spec.md](technical-spec.md):

- `DATABASE_URL` (plugin)
- `JWT_*`, `CORS_ORIGIN` (URL del front)
- `SMTP_*`, `MAIL_FROM`
- `VAPID_*`
- `ADMIN_SEED_*` (solo primer deploy; luego rotar / desactivar seed en prod)

## Release command sugerido

```bash
npx prisma migrate deploy && node dist/main.js
```

O build: `npm run build` + start `node dist/main.js`.

## Healthcheck

`GET /api/v1/health`

## CORS

`CORS_ORIGIN` = origen exacto del front. Sin `*`.

## Checklist pre-deploy

1. Repo en GitHub conectado a Railway.
2. Migraciones probadas en local con `migrate deploy`.
3. Secretos en Railway Variables (no en código).
4. SMTP real de la clínica o proveedor.
5. HTTPS (Railway lo provee).
6. Admin seed ejecutado una vez; password rotado.

## Lo que NO hacer ahora

- Crear proyecto Railway.
- Exponer la API a internet sin auth/seed seguros.
- Apuntar DNS de la clínica.

Cuando toque desplegar, abrir una tarea explícita y seguir este spec.
