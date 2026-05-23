const nodemailer = require("nodemailer");

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class EmailService {
  private static transporter = EmailService.buildTransporter();

  private static getFromAddress(): string | null {
    return process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || null;
  }

  private static buildTransporter() {
    const host = process.env.SMTP_HOST;
    const from = this.getFromAddress();

    if (!host || !from) {
      return null;
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || "false") === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  static isConfigured(): boolean {
    return Boolean(this.transporter && this.getFromAddress());
  }

  static async send(input: SendEmailInput): Promise<void> {
    const from = this.getFromAddress();

    if (!this.transporter || !from) {
      console.warn(
        `[email] SMTP nao configurado. Notificacao nao enviada para ${input.to}: ${input.subject}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }
}
