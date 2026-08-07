# Smoke test manual de los features 004 (reservas) y 005 (override de gerencia).
# Uso: .\scripts\smoke-reservations.ps1
# Requiere la API corriendo, el seed principal y el seed demo (npm run db:seed:demo).
# Trabaja sobre una fecha lejana y cancela todo lo que crea.

param(
    [string]$BaseUrl = 'http://localhost:3000/api/v1',
    [string]$UserEmail = 'usuario.demo@clinica.example',
    [string]$ManagerEmail = 'gerente.demo@clinica.example',
    [string]$DemoPassword = 'Demo123*',
    [string]$AdminEmail = 'admin@nexus.local',
    [string]$AdminPassword = 'Admin123*'
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
        [string]$Expect = 'OK',
        [string]$Label
    )

    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }

    $json = $null
    if ($Body) { $json = ($Body | ConvertTo-Json -Depth 5 -Compress) }

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

    $name = if ($Label) { $Label } else { "$Method $Path" }
    Test-Check $name ($result -eq $Expect) "-> $result"

    return $response
}

function Get-Token {
    param([string]$Email, [string]$Password)

    $session = Invoke-Api -Method POST -Path /auth/login `
        -Body @{ email = $Email; password = $Password } -Label "login $Email"
    return $session.accessToken
}

function New-Draft {
    param([string]$RoomId, [string]$Date, [string]$Start, [string]$End, [string]$Title)

    return @{
        roomId      = $RoomId
        title       = $Title
        meetingDate = $Date
        startTime   = $Start
        endTime     = $End
    }
}

$today = (Get-Date).ToString('yyyy-MM-dd')
$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
$tomorrow = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
$testDate = (Get-Date).AddDays(20).ToString('yyyy-MM-dd')

Write-Host "`n[1] Sesiones de prueba (fecha de trabajo $testDate)"
$userToken = Get-Token -Email $UserEmail -Password $DemoPassword
$managerToken = Get-Token -Email $ManagerEmail -Password $DemoPassword
$adminToken = Get-Token -Email $AdminEmail -Password $AdminPassword

if (-not $userToken -or -not $managerToken) {
    Write-Host 'Sin sesiones demo; ejecuta npm run db:seed:demo en apps/api.' -ForegroundColor Red
    exit 1
}

$rooms = Invoke-Api -Method GET -Path /rooms -Token $userToken -Label 'GET /rooms'
$roomId = $rooms.items[0].id
$otherRoomId = $rooms.items[1].id
if (-not $roomId) {
    Write-Host 'Sin salas; ejecuta npm run db:seed en apps/api.' -ForegroundColor Red
    exit 1
}

Write-Host "`n[2] AC1 un usuario general reserva un horario libre"
$body = New-Draft -RoomId $roomId -Date $testDate -Start '08:00' -End '09:00' -Title 'Smoke reunion base'
$body.description = 'Creada por el smoke test.'
$body.inviteeEmails = @('Invitado.Uno@Clinica.example', 'invitado.uno@clinica.example', 'invitado.dos@clinica.example')
$base = Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $body -Label 'POST reserva valida'
Test-Check 'queda confirmada' ($base.status -eq 'confirmed')
Test-Check 'trae sala y organizador' ([bool]$base.roomName -and [bool]$base.organizerName)
Test-Check 'AC8 los invitados se deduplican y normalizan' ($base.invitees.Count -eq 2) "(invitees=$($base.invitees.Count))"
Test-Check 'los correos quedan en minuscula' (
    @($base.invitees | Where-Object { $_.email -cne $_.email.ToLower() }).Count -eq 0
)

Write-Host "`n[3] AC4 la salida debe ser posterior a la entrada"
$invalid = New-Draft -RoomId $roomId -Date $testDate -Start '10:00' -End '10:00' -Title 'Smoke horario invalido'
Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $invalid -Expect 'VALIDATION_ERROR' -Label 'entrada = salida' | Out-Null
$invalid.endTime = '09:00'
Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $invalid -Expect 'VALIDATION_ERROR' -Label 'salida antes de entrada' | Out-Null
$invalid.startTime = '25:00'
$invalid.endTime = '26:00'
Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $invalid -Expect 'VALIDATION_ERROR' -Label 'hora fuera de rango' | Out-Null

Write-Host "`n[4] AC3 la regla del dia de anticipacion"
$sameDay = New-Draft -RoomId $roomId -Date $today -Start '15:00' -End '16:00' -Title 'Smoke para hoy'
Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $sameDay -Expect 'ADVANCE_NOTICE' -Label 'reservar para hoy' | Out-Null
$sameDay.meetingDate = $yesterday
Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $sameDay -Expect 'ADVANCE_NOTICE' -Label 'reservar para ayer' | Out-Null
$sameDay.meetingDate = $tomorrow
$sameDay.roomId = $otherRoomId
$sameDay.startTime = '19:00'
$sameDay.endTime = '19:30'
$tomorrowReservation = Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $sameDay -Label 'manana si es valido'

Write-Host "`n[5] AC2 solapes en la misma sala"
$overlap = New-Draft -RoomId $roomId -Date $testDate -Start '08:00' -End '09:00' -Title 'Smoke mismo horario'
$conflictResponse = $null
try {
    Invoke-RestMethod -Method POST -Uri "$BaseUrl/reservations" -Headers @{ Authorization = "Bearer $userToken" } `
        -ContentType 'application/json' -Body ($overlap | ConvertTo-Json -Depth 5 -Compress) | Out-Null
    Test-Check 'horario identico rechazado' $false
}
catch {
    $conflictResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Test-Check 'horario identico rechazado' ($conflictResponse.code -eq 'ROOM_CONFLICT') "-> $($conflictResponse.code)"
    Test-Check 'el error explica con quien choca' ([bool]$conflictResponse.details.conflicts[0].organizerName)
    Test-Check 'un usuario general no puede sobreescribir' ($conflictResponse.details.canOverride -eq $false)
}

$overlap.startTime = '08:30'
$overlap.endTime = '09:30'
Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $overlap -Expect 'ROOM_CONFLICT' -Label 'solape parcial' | Out-Null
$overlap.startTime = '07:00'
$overlap.endTime = '10:00'
Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $overlap -Expect 'ROOM_CONFLICT' -Label 'reserva contenedora' | Out-Null

$contiguous = New-Draft -RoomId $roomId -Date $testDate -Start '09:00' -End '10:00' -Title 'Smoke contigua'
$contiguousReservation = Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $contiguous -Label 'horario contiguo permitido'

$otherRoom = New-Draft -RoomId $otherRoomId -Date $testDate -Start '08:00' -End '09:00' -Title 'Smoke otra sala'
$otherRoomReservation = Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $otherRoom -Label 'mismo horario en otra sala'

Write-Host "`n[6] AC5 el admin no reserva"
$adminDraft = New-Draft -RoomId $otherRoomId -Date $testDate -Start '16:00' -End '17:00' -Title 'Smoke admin'
Invoke-Api -Method POST -Path /reservations -Token $adminToken -Body $adminDraft -Expect 'FORBIDDEN' -Label 'admin intenta reservar' | Out-Null

Write-Host "`n[7] Feature 005 AC2 solo gerencia puede forzar"
$forced = New-Draft -RoomId $roomId -Date $testDate -Start '08:00' -End '09:00' -Title 'Smoke force de usuario'
$forced.force = $true
Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $forced -Expect 'FORBIDDEN' -Label 'usuario con force=true' | Out-Null

Write-Host "`n[8] Feature 005 AC1 gerencia sobreescribe la sala ocupada"
$override = New-Draft -RoomId $roomId -Date $testDate -Start '08:30' -End '09:00' -Title 'Smoke reunion de gerencia'
$conflictForManager = Invoke-Api -Method POST -Path /reservations -Token $managerToken -Body $override -Expect 'ROOM_CONFLICT' -Label 'gerencia sin force respeta la sala'
$override.force = $true
$managerReservation = Invoke-Api -Method POST -Path /reservations -Token $managerToken -Body $override -Label 'gerencia con force toma la sala'
Test-Check 'la reserva de gerencia queda confirmada' ($managerReservation.status -eq 'confirmed')

$displaced = Invoke-Api -Method GET -Path "/reservations/$($base.id)" -Token $userToken -Label 'estado de la reserva desplazada'
Test-Check 'AC3 la desplazada queda overridden' ($displaced.status -eq 'overridden') "-> $($displaced.status)"
$overriddenList = Invoke-Api -Method GET -Path "/reservations?from=$testDate&to=$testDate&status=overridden" -Token $userToken -Label 'listado de sobreescritas'
Test-Check 'aparece en el historial de sobreescritas' (
    [bool]($overriddenList.items | Where-Object { $_.id -eq $base.id })
)
$confirmedList = Invoke-Api -Method GET -Path "/reservations?from=$testDate&to=$testDate&roomId=$roomId" -Token $userToken -Label 'ocupacion del dia'
Test-Check 'la desplazada ya no ocupa la sala' (
    -not ($confirmedList.items | Where-Object { $_.id -eq $base.id })
)
Test-Check 'solo desplaza lo que realmente se solapa: la contigua sigue en pie' (
    [bool]($confirmedList.items | Where-Object { $_.id -eq $contiguousReservation.id })
)
Write-Host '  nota: revisa el correo del override en Mailhog (http://localhost:8025)' -ForegroundColor Yellow

Write-Host "`n[9] AC6 el organizador cancela su reserva y libera el horario"
Invoke-Api -Method DELETE -Path "/reservations/$($contiguousReservation.id)" -Token $userToken -Label 'el organizador cancela' | Out-Null
$afterCancel = Invoke-Api -Method GET -Path "/reservations/$($contiguousReservation.id)" -Token $userToken -Label 'estado luego de cancelar'
Test-Check 'queda cancelada' ($afterCancel.status -eq 'cancelled') "-> $($afterCancel.status)"
$reuse = New-Draft -RoomId $roomId -Date $testDate -Start '09:00' -End '10:00' -Title 'Smoke reutiliza el horario'
$reuseReservation = Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $reuse -Label 'el horario liberado se puede reservar'
Invoke-Api -Method DELETE -Path "/reservations/$($reuseReservation.id)" -Token $userToken -Label 'limpieza del horario reutilizado' | Out-Null
Invoke-Api -Method DELETE -Path "/reservations/$($reuseReservation.id)" -Token $userToken -Expect 'VALIDATION_ERROR' -Label 'no se cancela dos veces' | Out-Null

Write-Host "`n[10] AC7 permisos de cancelacion"
Invoke-Api -Method DELETE -Path "/reservations/$($managerReservation.id)" -Token $userToken -Expect 'FORBIDDEN' -Label 'usuario cancela una ajena' | Out-Null
Invoke-Api -Method DELETE -Path "/reservations/$($managerReservation.id)" -Token $adminToken -Expect 'FORBIDDEN' -Label 'admin cancela una reserva' | Out-Null
Invoke-Api -Method DELETE -Path "/reservations/$($otherRoomReservation.id)" -Token $managerToken -Label 'gerencia cancela una ajena' | Out-Null

Write-Host "`n[11] Sin token no se crea ni se cancela"
$anon = New-Draft -RoomId $roomId -Date $testDate -Start '17:00' -End '18:00' -Title 'Smoke anonimo'
Invoke-Api -Method POST -Path /reservations -Body $anon -Expect 'UNAUTHORIZED' -Label 'POST sin token' | Out-Null
Invoke-Api -Method DELETE -Path "/reservations/$($managerReservation.id)" -Expect 'UNAUTHORIZED' -Label 'DELETE sin token' | Out-Null

Write-Host "`n[12] Limpieza"
Invoke-Api -Method DELETE -Path "/reservations/$($managerReservation.id)" -Token $managerToken -Label 'cancela la reserva de gerencia' | Out-Null
if ($tomorrowReservation.id) {
    Invoke-Api -Method DELETE -Path "/reservations/$($tomorrowReservation.id)" -Token $userToken -Label 'cancela la reserva de manana' | Out-Null
}
$leftovers = Invoke-Api -Method GET -Path "/reservations?from=$testDate&to=$testDate" -Token $userToken -Label 'el dia de prueba queda limpio'
Test-Check 'sin reservas confirmadas de prueba' ($leftovers.items.Count -eq 0) "(items=$($leftovers.items.Count))"

if ($script:failures -eq 0) {
    Write-Host "`nTodos los chequeos pasaron." -ForegroundColor Green
}
else {
    Write-Host "`n$($script:failures) chequeo(s) fallaron." -ForegroundColor Red
    exit 1
}
