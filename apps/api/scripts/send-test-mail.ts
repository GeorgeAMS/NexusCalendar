/**
 * Envia un correo de prueba con Brevo / Resend / SMTP.
 *
 * Uso (desde apps/api):
 *   npm run mail:test -- tu@correo.com
 *   npm run mail:test -- tu@correo.com invite
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as nodemailer from 'nodemailer';
import { reservationInviteTemplate } from '../src/notifications/templates';

function loadEnvFile(filePath: string): void {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    console.error(`No se pudo leer ${filePath}`);
    process.exit(1);
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function sampleInvite(to: string): { subject: string; text: string; html?: string } {
  const webUrl =
    process.env.APP_WEB_URL?.trim() ||
    process.env.CORS_ORIGIN?.split(',')[0]?.trim() ||
    'https://nexuscalendar.up.railway.app';

  const message = reservationInviteTemplate({
    reservation: {
      title: 'Comite de calidad',
      description: 'Revision de indicadores del mes (correo de prueba).',
      roomName: 'Sala de juntas Nexus',
      meetingDate: '2026-08-20',
      startTime: '08:00',
      endTime: '09:30',
      organizerName: 'Gerencia Nexus',
    },
    webUrl,
  });

  console.log(`Plantilla invite → ${to}`);
  return {
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  };
}

function parseFrom(from: string): { name?: string; email: string } {
  const angled = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angled) {
    const name = angled[1]?.replace(/^["']|["']$/g, '').trim();
    return {
      email: angled[2].trim(),
      ...(name ? { name } : {}),
    };
  }
  return { email: from.trim() };
}

async function sendBrevo(
  to: string,
  payload: { subject: string; text: string; html?: string },
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY no definido');
  }
  const fromRaw =
    process.env.MAIL_FROM ?? 'Nexus Calendar <nexuscalendar2026@gmail.com>';
  const sender = parseFrom(fromRaw);

  console.log('Enviando via Brevo API...');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: sender.email,
        ...(sender.name ? { name: sender.name } : {}),
      },
      to: [{ email: to }],
      subject: payload.subject,
      textContent: payload.text,
      ...(payload.html ? { htmlContent: payload.html } : {}),
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Brevo HTTP ${response.status}: ${body}`);
  }
  console.log(`Correo de prueba enviado a ${to} (Brevo) ${body}`);
}

async function sendResend(
  to: string,
  payload: { subject: string; text: string; html?: string },
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY no definido');
  }
  const from =
    process.env.MAIL_FROM ?? 'Nexus Calendar <onboarding@resend.dev>';

  console.log('Enviando via Resend API...');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: payload.subject,
      text: payload.text,
      ...(payload.html ? { html: payload.html } : {}),
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Resend HTTP ${response.status}: ${body}`);
  }
  console.log(`Correo de prueba enviado a ${to} (Resend) ${body}`);
}

async function sendSmtp(
  to: string,
  payload: { subject: string; text: string; html?: string },
): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    throw new Error('Ni BREVO_API_KEY / RESEND_API_KEY ni SMTP_HOST estan definidos');
  }

  const port = Number(process.env.SMTP_PORT ?? 1025);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const secureFlag = process.env.SMTP_SECURE;
  const secure =
    secureFlag === 'true' || secureFlag === '1' || (!secureFlag && port === 465);
  const from = process.env.MAIL_FROM ?? 'Nexus Calendar <nexus@localhost>';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    requireTLS: !secure && port === 587,
    family: 4,
    connectionTimeout: 10_000,
  } as nodemailer.TransportOptions);

  console.log(`Verificando SMTP ${host}:${port}...`);
  await transporter.verify();
  console.log('SMTP OK. Enviando...');

  await transporter.sendMail({
    from,
    to,
    subject: payload.subject,
    text: payload.text,
    ...(payload.html ? { html: payload.html } : {}),
  });

  console.log(`Correo de prueba enviado a ${to} (SMTP)`);
}

async function main(): Promise<void> {
  const to = process.argv[2];
  const kind = process.argv[3] ?? 'simple';
  if (!to) {
    console.error('Uso: npm run mail:test -- tu@correo.com [invite]');
    process.exit(1);
  }

  loadEnvFile(resolve(__dirname, '../.env'));

  const payload =
    kind === 'invite'
      ? sampleInvite(to)
      : {
          subject: 'Nexus Calendar — correo de prueba',
          text: [
            'Si lees esto, el correo de Nexus Calendar esta bien configurado.',
            '',
            `Enviado a: ${to}`,
            '',
            'Clinica Regional del San Jorge',
          ].join('\n'),
        };

  if (process.env.BREVO_API_KEY?.trim()) {
    await sendBrevo(to, payload);
    return;
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    await sendResend(to, payload);
    return;
  }

  await sendSmtp(to, payload);
}

main().catch((error: unknown) => {
  console.error('Fallo el envio:', error);
  process.exit(1);
});
