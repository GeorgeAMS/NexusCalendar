/**
 * Envia un correo de prueba con la config SMTP actual de apps/api/.env
 *
 * Uso (desde apps/api):
 *   npm run mail:test -- tu@correo.com
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as nodemailer from 'nodemailer';

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

async function main(): Promise<void> {
  const to = process.argv[2];
  if (!to) {
    console.error('Uso: npm run mail:test -- tu@correo.com');
    process.exit(1);
  }

  loadEnvFile(resolve(__dirname, '../.env'));

  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.error('SMTP_HOST no esta definido en apps/api/.env');
    process.exit(1);
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
  });

  console.log(`Verificando SMTP ${host}:${port}...`);
  await transporter.verify();
  console.log('SMTP OK. Enviando...');

  await transporter.sendMail({
    from,
    to,
    subject: 'Nexus Calendar — correo de prueba',
    text: [
      'Si lees esto, el SMTP de Nexus Calendar esta bien configurado.',
      '',
      `Enviado a: ${to}`,
      `Desde: ${from}`,
      '',
      'Clinica Regional del San Jorge',
    ].join('\n'),
  });

  console.log(`Correo de prueba enviado a ${to}`);
}

main().catch((error: unknown) => {
  console.error('Fallo el envio:', error);
  process.exit(1);
});
