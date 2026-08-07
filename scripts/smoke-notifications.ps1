# Smoke test manual del feature 006 (invitaciones y notificaciones).
# Uso: .\scripts\smoke-notifications.ps1
# Requiere la API corriendo, Mailhog, el seed principal y el seed demo.
# Vacia el buzon de Mailhog al empezar y cancela las reservas que crea.

param(
    [string]$BaseUrl = 'http://localhost:3000/api/v1',
    [string]$MailhogUrl = 'http://localhost:8025',
    [string]$UserEmail = 'usuario.demo@clinica.example',
    [string]$ManagerEmail = 'gerente.demo@clinica.example',
    [string]$DemoPassword = 'Demo123*',
    [string]$AdminEmail = 'admin@nexus.local',
    [string]$AdminPassword = 'Admin123*',
    [string]$ExternalEmail = 'externo.smoke@otra.example'
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

function Get-Mail {
    param([string]$Email)

    try {
        return Invoke-RestMethod -Uri "$MailhogUrl/api/v2/search?kind=to&query=$Email"
    }
    catch {
        Write-Host "  FALLO no se pudo consultar Mailhog en $MailhogUrl" -ForegroundColor Red
        $script:failures++
        return $null
    }
}

function Get-MailCount {
    param([string]$Email)

    $mail = Get-Mail -Email $Email
    if (-not $mail) { return -1 }
    return [int]$mail.total
}

function Test-LastMailContains {
    param([string]$Email, [string]$Text, [string]$Label)

    $mail = Get-Mail -Email $Email
    $body = if ($mail -and $mail.total -ge 1) { $mail.items[0].Content.Body } else { '' }
    Test-Check $Label ($body -match [regex]::Escape($Text))
}

function Get-Inbox {
    param([string]$Token)

    return Invoke-RestMethod -Uri "$BaseUrl/notifications" -Headers @{ Authorization = "Bearer $Token" }
}

function New-Draft {
    param([string]$RoomId, [string]$Date, [string]$Start, [string]$End, [string]$Title, [string[]]$Invitees)

    $draft = @{
        roomId      = $RoomId
        title       = $Title
        meetingDate = $Date
        startTime   = $Start
        endTime     = $End
    }
    if ($Invitees) { $draft.inviteeEmails = $Invitees }
    return $draft
}

$testDate = (Get-Date).AddDays(21).ToString('yyyy-MM-dd')

Write-Host "`n[1] Sesiones y buzon limpio (fecha de trabajo $testDate)"
$userToken = Get-Token -Email $UserEmail -Password $DemoPassword
$managerToken = Get-Token -Email $ManagerEmail -Password $DemoPassword
$adminToken = Get-Token -Email $AdminEmail -Password $AdminPassword

if (-not $userToken -or -not $managerToken -or -not $adminToken) {
    Write-Host 'Sin sesiones; ejecuta npm run db:seed:demo en apps/api.' -ForegroundColor Red
    exit 1
}

try {
    Invoke-RestMethod -Method DELETE -Uri "$MailhogUrl/api/v1/messages" | Out-Null
    Test-Check 'Mailhog vaciado' $true
}
catch {
    Test-Check 'Mailhog vaciado' $false "($MailhogUrl no responde)"
    exit 1
}

Invoke-Api -Method POST -Path /notifications/read -Token $userToken -Body @{} -Label 'buzon del usuario a cero' | Out-Null
Invoke-Api -Method POST -Path /notifications/read -Token $managerToken -Body @{} -Label 'buzon de gerencia a cero' | Out-Null

$rooms = Invoke-Api -Method GET -Path /rooms -Token $userToken -Label 'GET /rooms'
$roomA = $rooms.items[0].id
$roomB = $rooms.items[1].id

Write-Host "`n[2] AC2 crear reserva con invitados manda un correo por destinatario"
$draft = New-Draft -RoomId $roomA -Date $testDate -Start '08:00' -End '09:00' `
    -Title 'Smoke invitacion' -Invitees @($ManagerEmail, $ExternalEmail)
$draft.description = 'Revision del smoke de notificaciones.'
$r1 = Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $draft -Label 'POST reserva con invitados'
Test-Check 'un correo al invitado con cuenta' ((Get-MailCount -Email $ManagerEmail) -eq 1)
Test-Check 'un correo al invitado externo' ((Get-MailCount -Email $ExternalEmail) -eq 1)
Test-LastMailContains -Email $ExternalEmail -Text 'te invito a una reunion' -Label 'el correo explica quien invita'
Test-LastMailContains -Email $ExternalEmail -Text 'Smoke invitacion' -Label 'el correo trae el nombre de la reunion'

$managerInbox = Get-Inbox -Token $managerToken
$invite = $managerInbox.items | Where-Object { $_.type -eq 'reservation.invite' } | Select-Object -First 1
Test-Check 'AC in-app: la invitacion queda en el buzon' ([bool]$invite)
Test-Check 'el buzon apunta a la reserva' ($invite.payload.reservationId -eq $r1.id)
Test-Check 'la invitacion llega sin leer' ($managerInbox.unread -ge 1) "(unread=$($managerInbox.unread))"

Write-Host "`n[3] AC3 el override avisa al organizador desplazado y a sus invitados"
$override = New-Draft -RoomId $roomA -Date $testDate -Start '08:30' -End '09:00' -Title 'Smoke override'
$override.force = $true
$r2 = Invoke-Api -Method POST -Path /reservations -Token $managerToken -Body $override -Label 'gerencia toma la sala'
Test-Check 'el organizador desplazado recibe correo' ((Get-MailCount -Email $UserEmail) -eq 1)
Test-LastMailContains -Email $UserEmail -Text 'reserva de gerencia' -Label 'el correo explica el motivo'
Test-Check 'el invitado externo tambien se entera' ((Get-MailCount -Email $ExternalEmail) -eq 2)

$userInbox = Get-Inbox -Token $userToken
Test-Check 'el buzon del organizador registra el override' (
    [bool]($userInbox.items | Where-Object { $_.type -eq 'reservation.overridden' })
)

Write-Host "`n[4] AC de cancelacion: gerencia cancela y el organizador se entera"
$third = New-Draft -RoomId $roomB -Date $testDate -Start '10:00' -End '11:00' `
    -Title 'Smoke cancelacion ajena' -Invitees @($ManagerEmail)
$r3 = Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $third -Label 'POST reserva a cancelar'
$userMailBefore = Get-MailCount -Email $UserEmail
Invoke-Api -Method DELETE -Path "/reservations/$($r3.id)" -Token $managerToken -Label 'gerencia cancela' | Out-Null
Test-Check 'el organizador recibe el aviso de cancelacion' (
    (Get-MailCount -Email $UserEmail) -eq ($userMailBefore + 1)
)
Test-LastMailContains -Email $UserEmail -Text 'fue cancelada' -Label 'el correo dice que se cancelo'
Test-Check 'el buzon del organizador registra la cancelacion' (
    [bool]((Get-Inbox -Token $userToken).items | Where-Object { $_.type -eq 'reservation.cancelled' })
)

Write-Host "`n[5] Cancelar lo propio no se auto-notifica"
$fourth = New-Draft -RoomId $roomB -Date $testDate -Start '11:00' -End '12:00' `
    -Title 'Smoke cancelacion propia' -Invitees @($ManagerEmail)
$r4 = Invoke-Api -Method POST -Path /reservations -Token $userToken -Body $fourth -Label 'POST reserva propia'
$userMailBefore = Get-MailCount -Email $UserEmail
$managerMailBefore = Get-MailCount -Email $ManagerEmail
Invoke-Api -Method DELETE -Path "/reservations/$($r4.id)" -Token $userToken -Label 'el organizador cancela' | Out-Null
Test-Check 'el organizador no se escribe a si mismo' ((Get-MailCount -Email $UserEmail) -eq $userMailBefore)
Test-Check 'el invitado si recibe el aviso' (
    (Get-MailCount -Email $ManagerEmail) -eq ($managerMailBefore + 1)
)

Write-Host "`n[6] Buzon in-app: listado, marcado y validaciones"
$inbox = Get-Inbox -Token $managerToken
Test-Check 'el buzon de gerencia tiene avisos' ($inbox.items.Count -ge 2) "(items=$($inbox.items.Count))"
Test-Check 'vienen del mas nuevo al mas viejo' (
    $inbox.items.Count -lt 2 -or ([datetime]$inbox.items[0].createdAt -ge [datetime]$inbox.items[1].createdAt)
)
$unreadOnly = Invoke-Api -Method GET -Path '/notifications?unread=true&limit=5' -Token $managerToken -Label 'GET /notifications?unread=true'
Test-Check 'el filtro de no leidas respeta el limite' ($unreadOnly.items.Count -le 5)
Test-Check 'todas las del filtro estan sin leer' (
    @($unreadOnly.items | Where-Object { $null -ne $_.readAt }).Count -eq 0
)
$read = Invoke-Api -Method POST -Path /notifications/read -Token $managerToken -Body @{} -Label 'marcar todo como leido'
Test-Check 'marco al menos un aviso' ($read.updated -ge 1) "(updated=$($read.updated))"
Test-Check 'el contador queda en cero' ((Get-Inbox -Token $managerToken).unread -eq 0)
Invoke-Api -Method POST -Path /notifications/read -Token $managerToken -Body @{ ids = @('no-es-uuid') } `
    -Expect 'VALIDATION_ERROR' -Label 'ids invalidos rechazados' | Out-Null

Write-Host "`n[7] AC5 suscripcion de push"
$key = Invoke-Api -Method GET -Path /push/public-key -Token $userToken -Label 'GET /push/public-key'
if ($key.publicKey) {
    Write-Host '  nota: VAPID configurado, el push se enviara de verdad' -ForegroundColor Yellow
}
else {
    Write-Host '  nota: sin VAPID el push queda deshabilitado (genera claves con npm run push:keys)' -ForegroundColor Yellow
}

$endpoint = "https://fcm.googleapis.com/fcm/send/smoke-$([guid]::NewGuid())"
$subscription = @{
    endpoint = $endpoint
    keys     = @{ p256dh = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'; auth = 'tBHItJI5svbpez7KI4CCXg' }
}
$saved = Invoke-Api -Method POST -Path /push/subscribe -Token $userToken -Body $subscription -Label 'POST /push/subscribe'
Test-Check 'devuelve el id de la subscription' ([bool]$saved.id)
$again = Invoke-Api -Method POST -Path /push/subscribe -Token $userToken -Body $subscription -Label 'repetir la subscripcion es idempotente'
Test-Check 'el mismo endpoint no se duplica' ($again.id -eq $saved.id)
Invoke-Api -Method POST -Path /push/subscribe -Token $userToken -Body @{ endpoint = $endpoint } `
    -Expect 'VALIDATION_ERROR' -Label 'subscription sin keys rechazada' | Out-Null
Invoke-Api -Method DELETE -Path /push/subscribe -Token $userToken -Body @{ endpoint = $endpoint } -Label 'DELETE /push/subscribe' | Out-Null
Invoke-Api -Method DELETE -Path /push/subscribe -Token $userToken -Body @{ endpoint = $endpoint } -Label 'borrar dos veces no falla' | Out-Null

Write-Host "`n[8] Sin token no hay buzon ni push"
Invoke-Api -Method GET -Path /notifications -Expect 'UNAUTHORIZED' -Label 'GET /notifications sin token' | Out-Null
Invoke-Api -Method POST -Path /push/subscribe -Body $subscription -Expect 'UNAUTHORIZED' -Label 'POST /push/subscribe sin token' | Out-Null

Write-Host "`n[9] AC6 desactivar una cuenta borra sus subscriptions"
$candidate = @{
    fullName = 'Solicitante Push Smoke'
    email    = "push.smoke.$([guid]::NewGuid().ToString('N').Substring(0, 8))@clinica.example"
    phone    = '3009998877'
    password = 'Smoke123*'
}
Invoke-Api -Method POST -Path /auth/register -Body $candidate -Label 'registro del candidato' | Out-Null
$pending = Invoke-Api -Method GET -Path '/admin/users?status=pending&pageSize=100' -Token $adminToken -Label 'bandeja de pendientes'
$target = $pending.items | Where-Object { $_.email -eq $candidate.email }
Invoke-Api -Method PATCH -Path "/admin/users/$($target.id)/approve" -Token $adminToken -Body @{ role = 'usuario' } -Label 'aprobacion con rol' | Out-Null
$candidateToken = Get-Token -Email $candidate.email -Password $candidate.password
$candidateEndpoint = "https://fcm.googleapis.com/fcm/send/smoke-$([guid]::NewGuid())"
Invoke-Api -Method POST -Path /push/subscribe -Token $candidateToken `
    -Body @{ endpoint = $candidateEndpoint; keys = $subscription.keys } -Label 'el candidato se suscribe' | Out-Null
Test-Check 'AC1 la aprobacion le manda correo' ((Get-MailCount -Email $candidate.email) -ge 1)

Invoke-Api -Method DELETE -Path "/admin/users/$($target.id)" -Token $adminToken -Label 'el admin desactiva la cuenta' | Out-Null

$query = "select count(*) from push_subscriptions where user_id = '$($target.id)'"
try {
    $remaining = "$(docker exec nexus-postgres psql -U nexus -d nexus_calendar -t -A -c $query)".Trim()
    Test-Check 'no quedan subscriptions de la cuenta desactivada' ($remaining -eq '0') "(count=$remaining)"
}
catch {
    Write-Host '  nota: no se pudo consultar la base con docker; verificacion omitida' -ForegroundColor Yellow
}

Write-Host "`n[10] Limpieza"
Invoke-Api -Method DELETE -Path "/reservations/$($r2.id)" -Token $managerToken -Label 'cancela la reserva de gerencia' | Out-Null
$leftovers = Invoke-Api -Method GET -Path "/reservations?from=$testDate&to=$testDate" -Token $userToken -Label 'el dia de prueba queda limpio'
Test-Check 'sin reservas confirmadas de prueba' ($leftovers.items.Count -eq 0) "(items=$($leftovers.items.Count))"

if ($script:failures -eq 0) {
    Write-Host "`nTodos los chequeos pasaron." -ForegroundColor Green
}
else {
    Write-Host "`n$($script:failures) chequeo(s) fallaron." -ForegroundColor Red
    exit 1
}
