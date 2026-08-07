# Smoke test manual de los criterios de aceptacion del feature 001 (auth y registro).
# Uso: .\scripts\smoke-auth.ps1
# Requiere la API corriendo y el seed aplicado. No imprime tokens.

param(
    [string]$BaseUrl = 'http://localhost:3000/api/v1',
    [string]$AdminEmail = 'admin@nexus.local',
    [string]$AdminPassword = 'Admin123*'
)

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Body,
        [string]$Token
    )

    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }

    $json = $null
    if ($Body) { $json = ($Body | ConvertTo-Json -Compress) }

    try {
        $response = Invoke-RestMethod -Method $Method -Uri "$BaseUrl$Path" `
            -Headers $headers -ContentType 'application/json' -Body $json
        $visible = $response.PSObject.Properties |
            Where-Object { $_.Name -notin @('accessToken', 'refreshToken') }
        Write-Host "OK   $Method $Path" -ForegroundColor Green
        if ($visible) {
            $shown = $response | Select-Object -Property $visible.Name
            Write-Host "     $($shown | ConvertTo-Json -Compress -Depth 4)"
        }
        else {
            Write-Host '     (solo tokens; se omiten en la salida)'
        }
        return $response
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "HTTP $status $Method $Path" -ForegroundColor Yellow
        Write-Host "     $($_.ErrorDetails.Message)"
        return $null
    }
}

$email = "prueba$(Get-Random)@clinica.example"
$password = 'secretoSeguro1'
$candidate = @{ fullName = 'Persona De Prueba'; email = $email; phone = '3001234567'; password = $password }

Write-Host "`nAC1 registro crea cuenta pending"
Invoke-Api -Method POST -Path /auth/register -Body $candidate | Out-Null

Write-Host "`nAC2 correo duplicado -> EMAIL_TAKEN"
Invoke-Api -Method POST -Path /auth/register -Body $candidate | Out-Null

Write-Host "`nAC3 login pending -> ACCOUNT_PENDING"
Invoke-Api -Method POST -Path /auth/login -Body @{ email = $email; password = $password } | Out-Null

Write-Host "`nAC4 login de cuenta activa (admin del seed)"
$session = Invoke-Api -Method POST -Path /auth/login -Body @{ email = $AdminEmail; password = $AdminPassword }
Write-Host "     access y refresh recibidos: $([bool]$session.accessToken) / $([bool]$session.refreshToken)"

Write-Host "`nAC5 /auth/me con token"
Invoke-Api -Method GET -Path /auth/me -Token $session.accessToken | Out-Null

Write-Host "`nAC5 /auth/me sin token -> UNAUTHORIZED"
Invoke-Api -Method GET -Path /auth/me | Out-Null

Write-Host "`nRefresh de sesion"
$renewed = Invoke-Api -Method POST -Path /auth/refresh -Body @{ refreshToken = $session.refreshToken }
Write-Host "     nuevo access token: $([bool]$renewed.accessToken)"

Write-Host "`nCredenciales incorrectas -> UNAUTHORIZED"
Invoke-Api -Method POST -Path /auth/login -Body @{ email = $AdminEmail; password = 'claveIncorrecta' } | Out-Null

Write-Host "`nDatos invalidos -> VALIDATION_ERROR"
Invoke-Api -Method POST -Path /auth/register -Body @{ fullName = 'X'; email = 'no-es-correo'; phone = 'abc'; password = '123' } | Out-Null
