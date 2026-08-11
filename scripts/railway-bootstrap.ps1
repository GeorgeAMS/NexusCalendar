# Bootstrap Railway para Nexus Calendar (ejecutar DESPUES de: railway login)
# Uso (desde la raiz del repo):
#   railway login
#   powershell -ExecutionPolicy Bypass -File scripts/railway-bootstrap.ps1
#
# Crea proyecto, Postgres, y deja instrucciones para servicios api/web.
# Los servicios desde GitHub con Root Directory suelen crearse mejor en la UI.

$ErrorActionPreference = "Stop"

Write-Host "==> Verificando sesion Railway..."
railway whoami

Write-Host "==> Creando proyecto nexus-calendar (si no existe)..."
# init interactivo si no hay link; si ya hay .railway, continuar
if (-not (Test-Path ".railway")) {
  railway init -n nexus-calendar
} else {
  Write-Host "Ya hay proyecto linkeado (.railway)."
}

Write-Host "==> Anadiendo PostgreSQL..."
railway add --database postgres

Write-Host ""
Write-Host "Siguiente (en la UI de Railway o CLI):"
Write-Host "1) Servicio api: Root Directory = apps/api (usa apps/api/railway.toml)"
Write-Host "2) Variables api: DATABASE_URL (ref Postgres), JWT_*, SMTP_*, ADMIN_SEED_*, CORS_ORIGIN"
Write-Host "3) Dominio publico del api → health /api/v1/health"
Write-Host "4) Servicio web: Root Directory = apps/web"
Write-Host "5) Variable build web: VITE_API_URL=https://<api>.up.railway.app/api/v1"
Write-Host "6) Dominio web → actualizar CORS_ORIGIN y APP_WEB_URL en api → redeploy"
Write-Host ""
Write-Host "Detalle: specs/railway.md"
