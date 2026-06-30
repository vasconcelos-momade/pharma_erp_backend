import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { EmailService } from "../../../../../infrastructure/notifications/email.service";

export class ForgotPasswordUseCase {
  async execute(email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail.length > 0) {
      const prisma = prismaCentralUnscoped as any;
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, name: true, email: true, active: true },
      });

      if (user?.active && user.email) {
        await EmailService.send({
          to: user.email,
          subject: "Recuperação de palavra-passe — Pharma ERP",
          text: [
            `Olá ${user.name},`,
            "",
            "Recebemos um pedido de recuperação de palavra-passe para a sua conta Pharma ERP.",
            "Por motivos de segurança, contacte o administrador da farmácia para definir uma nova palavra-passe.",
            "",
            "Se não fez este pedido, ignore este e-mail.",
          ].join("\n"),
          html: [
            `<p>Olá <strong>${user.name}</strong>,</p>`,
            "<p>Recebemos um pedido de recuperação de palavra-passe para a sua conta Pharma ERP.</p>",
            "<p>Por motivos de segurança, contacte o administrador da farmácia para definir uma nova palavra-passe.</p>",
            "<p>Se não fez este pedido, ignore este e-mail.</p>",
          ].join(""),
        });
      }
    }

    return {
      message:
        "Se o e-mail estiver registado, receberá instruções de recuperação em breve.",
    };
  }
}
