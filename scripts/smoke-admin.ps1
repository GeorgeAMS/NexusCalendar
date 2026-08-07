# Smoke test manual de los criterios de aceptacion del feature 002 (admin de usuarios).
# Uso: .\scripts\smoke-admin.ps1
# Requiere la API corriendo, el seed aplicado y Mailhog levantado. No imprime tokens.

param(
    [string]$BaseUrl = 'http://localhost:3000/api/v1',
    [string]$MailhogUrl = 'http://localhost:8025',
    [string]$AdminEmail = 'admin@nexus.local',
    [string]$AdminPassword = 'Admin123*'
)

$script:failures = 0

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Body,
        [string]$Token,
        [string]$Expect = 'OK'
    )

    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }

    $json = $null
    if ($Body) { $json = ($Body | ConvertTo-Json -Compress) }

    try {
        $response = Invoke-RestMethod -Method $Method -Uri "$BaseUrl$Path" `
            -Headers $headers -ContentType 'application/json' -Body $json
        $result = 'OK'
    }
    catch {
        $response = $null
        $code = 'ERROR'
        if ($_.ErrorDetails.Message) {
            try { $code = ($_.ErrorDetails.Message | ConvertFrom-Json).code } catch { }
        }
        $result = $code
    }

    if ($result -eq $Expect) {
        Write-Host "  ok   $Method $Path -> $result" -ForegroundColor Green
    }
    else {
        Write-Host "  FALLO $Method $Path -> $result (esperaba $Expect)" -ForegroundColor Red
        $script:failures++
    }

    return $response
}

function New-Candidate {
    $email = "solicitante$(Get-Random)@clinica.example"
    return @{
        fullName = 'Solicitante De Prueba'
        email    = $email
        phone    = '3009998877'
        password = 'secretoSeguro1'
    }
}

Write-Host "`n[1] Login del administrador"
$adminSession = Invoke-Api -Method POST -Path /auth/login -Body @{ email = $AdminEmail; password = $AdminPassword }
$adminToken = $adminSession.accessToken
if (-not $adminToken) {
    Write-Host 'Sin sesion de administrador; se detiene el smoke.' -ForegroundColor Red
    exit 1
}

Write-Host "`n[2] AC2 bandeja de solicitudes pendientes"
$candidate = New-Candidate
Invoke-Api -Method POST -Path /auth/register -Body $candidate | Out-Null
$pending = Invoke-Api -Method GET -Path '/admin/users?status=pending' -Token $adminToken
$target = $pending.items | Where-Object { $_.email -eq $candidate.email }
$onlyPending = @($pending.items | Where-Object { $_.status -ne 'pending' }).Count -eq 0
Write-Host "  solicitante en la bandeja: $([bool]$target); todos pendientes: $onlyPending"

Write-Host "`n[3] AC3 aprobar asignando rol usuario"
$approved = Invoke-Api -Method PATCH -Path "/admin/users/$($target.id)/approve" -Body @{ role = 'usuario' } -Token $adminToken
Write-Host "  estado: $($approved.status) / rol: $($approved.role)"

Write-Host "`n[4] AC4 el aprobado ya puede iniciar sesion"
$userSession = Invoke-Api -Method POST -Path /auth/login -Body @{ email = $candidate.email; password = $candidate.password }

Write-Host "`n[5] AC1 un no-admin no entra a las rutas de administracion"
Invoke-Api -Method GET -Path /admin/users -Token $userSession.accessToken -Expect 'FORBIDDEN' | Out-Null

Write-Host "`n[6] Cambio de rol a gerencia"
$promoted = Invoke-Api -Method PATCH -Path "/admin/users/$($target.id)/role" -Body @{ role = 'gerencia' } -Token $adminToken
Write-Host "  rol: $($promoted.role)"

Write-Host "`n[7] AC7 correo de aprobacion en Mailhog"
try {
    $search = Invoke-RestMethod -Uri "$MailhogUrl/api/v2/search?kind=to&query=$($candidate.email)"
    if ($search.total -ge 1) {
        Write-Host "  ok   Mailhog tiene $($search.total) correo(s): $($search.items[0].Content.Headers.Subject)" -ForegroundColor Green
    }
    else {
        Write-Host '  FALLO Mailhog no recibio el correo de aprobacion' -ForegroundColor Red
        $script:failures++
    }
}
catch {
    Write-Host "  FALLO no se pudo consultar Mailhog en $MailhogUrl" -ForegroundColor Red
    $script:failures++
}

Write-Host "`n[8] AC6 desactivar impide el login"
Invoke-Api -Method DELETE -Path "/admin/users/$($target.id)" -Token $adminToken | Out-Null
Invoke-Api -Method POST -Path /auth/login -Body @{ email = $candidate.email; password = $candidate.password } -Expect 'ACCOUNT_DISABLED' | Out-Null

Write-Host "`n[9] AC5 rechazar impide el login"
$rejectedCandidate = New-Candidate
Invoke-Api -Method POST -Path /auth/register -Body $rejectedCandidate | Out-Null
$pending = Invoke-Api -Method GET -Path '/admin/users?status=pending' -Token $adminToken
$toReject = $pending.items | Where-Object { $_.email -eq $rejectedCandidate.email }
Invoke-Api -Method PATCH -Path "/admin/users/$($toReject.id)/reject" -Token $adminToken | Out-Null
Invoke-Api -Method POST -Path /auth/login `
    -Body @{ email = $rejectedCandidate.email; password = $rejectedCandidate.password } `
    -Expect 'ACCOUNT_REJECTED' | Out-Null

Write-Host "`n[10] Las cuentas de administrador estan protegidas"
$me = Invoke-Api -Method GET -Path /auth/me -Token $adminToken
Invoke-Api -Method DELETE -Path "/admin/users/$($me.id)" -Token $adminToken -Expect 'FORBIDDEN' | Out-Null

Write-Host "`n[11] Busqueda y paginacion"
$search = Invoke-Api -Method GET -Path '/admin/users?q=solicitante&pageSize=5' -Token $adminToken
Write-Host "  total=$($search.total) page=$($search.page) pageSize=$($search.pageSize) items=$($search.items.Count)"

if ($script:failures -eq 0) {
    Write-Host "`nTodos los chequeos pasaron." -ForegroundColor Green
}
else {
    Write-Host "`n$($script:failures) chequeo(s) fallaron." -ForegroundColor Red
    exit 1
}
