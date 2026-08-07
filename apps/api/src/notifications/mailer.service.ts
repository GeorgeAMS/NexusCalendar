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

/**
 * Envia correo por SMTP.
 * - Local con Mailhog: SMTP_HOST=localhost, SMTP_PORT=1025, sin user/pass.
 * - Correo real (Gmail/Outlook): host del proveedor + user/pass (app password).
 * Si no hay SMTP_HOST, solo registra el mensaje en el log.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      this.logger.warn('SMTP_HOST sin configurar: los correos se registraran en el log.');
      return;
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? 1025);
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS');
    const secureFlag = this.config.get<string>('SMTP_SECURE');
    // 465 = TLS implícito; 587 = STARTTLS (secure=false).
    const secure =
      secureFlag === 'true' || secureFlag === '1' || (!secureFlag && port === 465);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      // Gmail/Outlook en 587 necesitan STARTTLS.
      requireTLS: !secure && port === 587,
    });

    this.logger.log(
      `SMTP listo: ${host}:${port} (secure=${secure}${user ? `, user=${user}` : ', sin auth'})`,
    );
  }

  async send(message: MailMessage): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM') ?? 'Nexus Calendar <nexus@localhost>';

    if (!this.transporter) {
      this.logger.log(`[correo simulado] a ${message.to}: ${message.subject}`);
      return;
    }

    await this.transporter.sendMail({ from, ...message });
    this.logger.log(`Correo enviado a ${message.to}: ${message.subject}`);
  }

  /** Verifica la conexion SMTP (util al cambiar de Mailhog a Gmail). */
  async verify(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }
    await this.transporter.verify();
    return true;
  }
}
