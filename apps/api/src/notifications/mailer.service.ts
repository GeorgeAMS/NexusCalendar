import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

type MailMode = 'brevo' | 'resend' | 'smtp' | 'none';

interface ParsedFrom {
  name?: string;
  email: string;
}

/**
 * Envia correo.
 * - Produccion Railway (Hobby): SMTP bloqueado → usar BREVO_API_KEY o RESEND_API_KEY (HTTPS).
 * - Brevo: permite enviar a CUALQUIER destinatario con un remitente verificado
 *   (ej. nexuscalendar2026@gmail.com), sin DNS de dominio institucional.
 * - Resend con onboarding@resend.dev solo entrega al dueño de la cuenta.
 * - Local: SMTP_HOST=localhost (Mailhog).
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private mode: MailMode = 'none';
  private transporter: Transporter | null = null;
  private brevoApiKey: string | null = null;
  private resendApiKey: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const brevoKey = this.config.get<string>('BREVO_API_KEY')?.trim();
    if (brevoKey) {
      this.mode = 'brevo';
      this.brevoApiKey = brevoKey;
      this.logger.log('Correo listo: Brevo API (HTTPS :443)');
      return;
    }

    const resendKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (resendKey) {
      this.mode = 'resend';
      this.resendApiKey = resendKey;
      this.logger.log('Correo listo: Resend API (HTTPS :443)');
      return;
    }

    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      this.mode = 'none';
      this.logger.warn(
        'Sin BREVO_API_KEY / RESEND_API_KEY / SMTP_HOST: los correos se registraran en el log.',
      );
      return;
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? 1025);
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS');
    const secureFlag = this.config.get<string>('SMTP_SECURE');
    const secure =
      secureFlag === 'true' || secureFlag === '1' || (!secureFlag && port === 465);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      requireTLS: !secure && port === 587,
      family: 4,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    } as nodemailer.TransportOptions);

    this.mode = 'smtp';
    this.logger.log(
      `Correo listo: SMTP ${host}:${port} (secure=${secure}${user ? `, user=${user}` : ', sin auth'})`,
    );
  }

  async send(message: MailMessage): Promise<void> {
    const fromRaw =
      this.config.get<string>('MAIL_FROM') ?? 'Nexus Calendar <nexus@localhost>';

    if (this.mode === 'none') {
      this.logger.log(`[correo simulado] a ${message.to}: ${message.subject}`);
      return;
    }

    if (this.mode === 'brevo') {
      await this.sendViaBrevo(fromRaw, message);
      this.logger.log(`Correo enviado (Brevo) a ${message.to}: ${message.subject}`);
      return;
    }

    if (this.mode === 'resend') {
      await this.sendViaResend(fromRaw, message);
      this.logger.log(`Correo enviado (Resend) a ${message.to}: ${message.subject}`);
      return;
    }

    if (!this.transporter) {
      this.logger.log(`[correo simulado] a ${message.to}: ${message.subject}`);
      return;
    }

    await this.transporter.sendMail({ from: fromRaw, ...message });
    this.logger.log(`Correo enviado (SMTP) a ${message.to}: ${message.subject}`);
  }

  private parseFrom(from: string): ParsedFrom {
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

  private async sendViaBrevo(fromRaw: string, message: MailMessage): Promise<void> {
    const sender = this.parseFrom(fromRaw);
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.brevoApiKey ?? '',
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: sender.email,
          ...(sender.name ? { name: sender.name } : {}),
        },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        ...(message.html ? { htmlContent: message.html } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Brevo HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
  }

  private async sendViaResend(from: string, message: MailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
  }

  async verify(): Promise<boolean> {
    if (this.mode === 'brevo') {
      return Boolean(this.brevoApiKey);
    }
    if (this.mode === 'resend') {
      return Boolean(this.resendApiKey);
    }
    if (!this.transporter) {
      return false;
    }
    await this.transporter.verify();
    return true;
  }
}
