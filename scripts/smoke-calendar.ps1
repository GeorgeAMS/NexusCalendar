# Smoke test manual de los criterios de aceptacion del feature 003 (salas y calendario).
# Uso: .\scripts\smoke-calendar.ps1
# Requiere la API corriendo, el seed principal y el seed demo (npm run db:seed:demo).

param(
    [string]$BaseUrl = 'http://localhost:3000/api/v1',
    [string]$UserEmail = 'usuario.demo@clinica.example',
    [string]$UserPassword = 'Demo123*'
)

$script:failures = 0

function Test-Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = '')

    if ($Condition) {
        Write-Host "  ok   $Name $Detail" -ForegroundColor Green
    }
    else {
        Write-Host "  FALLO $Name $Detail" -ForegroundColor Red
        $script:failures++
    }
}

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
        $result = 'ERROR'
        if ($_.ErrorDetails.Message) {
            try { $result = ($_.ErrorDetails.Message | ConvertFrom-Json).code } catch { }
        }
    }

    Test-Check "$Method $Path" ($result -eq $Expect) "-> $result"

    return $response
}

$today = (Get-Date).ToString('yyyy-MM-dd')

Write-Host "`n[1] Login de un usuario general activo"
$session = Invoke-Api -Method POST -Path /auth/login -Body @{ email = $UserEmail; password = $UserPassword }
$token = $session.accessToken
if (-not $token) {
    Write-Host 'Sin sesion; ejecuta npm run db:seed:demo en apps/api.' -ForegroundColor Red
    exit 1
}

Write-Host "`n[2] AC1 y AC2 las tres salas del seed"
$rooms = Invoke-Api -Method GET -Path /rooms -Token $token
Test-Check 'devuelve 3 salas' ($rooms.items.Count -eq 3) "(items=$($rooms.items.Count))"
Test-Check 'todas activas' (@($rooms.items | Where-Object { -not $_.isActive }).Count -eq 0)
foreach ($slug in @('sala-juntas-nexus', 'sede-violeta', 'tercer-piso-cafeteria')) {
    Test-Check "contiene $slug" ([bool]($rooms.items | Where-Object { $_.slug -eq $slug }))
}

Write-Host "`n[3] AC2 listado de reservas visible para el usuario"
$all = Invoke-Api -Method GET -Path /reservations -Token $token
Test-Check 'hay reservas en la ventana por defecto' ($all.items.Count -ge 1) "(items=$($all.items.Count))"
Test-Check 'solo confirmadas' (@($all.items | Where-Object { $_.status -ne 'confirmed' }).Count -eq 0)
Test-Check 'incluye nombre de sala y organizador' ([bool]$all.items[0].roomName -and [bool]$all.items[0].organizerName)

Write-Host "`n[4] AC3 filtro por sala"
$roomId = $all.items[0].roomId
$byRoom = Invoke-Api -Method GET -Path "/reservations?roomId=$roomId" -Token $token
Test-Check 'todas las reservas son de la sala pedida' (
    @($byRoom.items | Where-Object { $_.roomId -ne $roomId }).Count -eq 0
) "(items=$($byRoom.items.Count))"

Write-Host "`n[5] AC4 filtro por rango de fechas"
$target = $all.items[0].meetingDate
$sameDay = Invoke-Api -Method GET -Path "/reservations?from=$target&to=$target" -Token $token
Test-Check 'solo devuelve el dia pedido' (
    @($sameDay.items | Where-Object { $_.meetingDate -ne $target }).Count -eq 0
) "(items=$($sameDay.items.Count))"

$past = Invoke-Api -Method GET -Path "/reservations?from=2020-01-01&to=2020-01-31" -Token $token
Test-Check 'rango sin datos devuelve vacio' ($past.items.Count -eq 0)

Write-Host "`n[6] Detalle de una reserva"
$detail = Invoke-Api -Method GET -Path "/reservations/$($all.items[0].id)" -Token $token
Test-Check 'el detalle trae invitados' ($null -ne $detail.invitees)

Write-Host "`n[7] AC5 sin token no hay acceso"
Invoke-Api -Method GET -Path /rooms -Expect 'UNAUTHORIZED' | Out-Null
Invoke-Api -Method GET -Path /reservations -Expect 'UNAUTHORIZED' | Out-Null

Write-Host "`n[8] Validacion de parametros"
Invoke-Api -Method GET -Path '/reservations?from=08-2026' -Token $token -Expect 'VALIDATION_ERROR' | Out-Null
Invoke-Api -Method GET -Path "/reservations?from=$today&to=2020-01-01" -Token $token -Expect 'VALIDATION_ERROR' | Out-Null
Invoke-Api -Method GET -Path '/reservations/no-es-uuid' -Token $token -Expect 'VALIDATION_ERROR' | Out-Null

if ($script:failures -eq 0) {
    Write-Host "`nTodos los chequeos pasaron." -ForegroundColor Green
}
else {
    Write-Host "`n$($script:failures) chequeo(s) fallaron." -ForegroundColor Red
    exit 1
}
