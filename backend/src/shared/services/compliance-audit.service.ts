import { createHash } from "crypto";
import { getPrisma } from "../../infrastructure/prisma/tenant-prisma.factory";
import { serializeForJson } from "../http/serialize-json";

export class ComplianceAuditService {
  /**
   * Cria um log de auditoria imutável com encadeamento criptográfico.
   */
  async createImmutableLog(data: {
    userId: string | bigint;
    action: string;
    entity: string;
    entityId?: string | bigint;
    before?: any;
    after?: any;
    ip?: string;
    userAgent?: string;
  }, externalTx?: any) {
    const prisma = externalTx || getPrisma();

    // 1. Buscar o último log para obter o hashAtual (que será o hashAnterior deste novo log)
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { id: "desc" },
      select: { hashAtual: true }
    });

    const hashAnterior = lastLog?.hashAtual || "GENESIS_HASH";

    // 2. Preparar os dados para o novo log (sem os hashes ainda)
    const logData = {
      userId: BigInt(data.userId),
      action: data.action,
      entity: data.entity,
      entityId: data.entityId ? BigInt(data.entityId) : null,
      before: data.before || null,
      after: data.after || null,
      ip: data.ip || null,
      userAgent: data.userAgent || null,
      createdAt: new Date()
    };

    // 3. Calcular o novo hashAtual: SHA256(dados do log + hashAnterior)
    const logContent = JSON.stringify(
      serializeForJson({
        ...logData,
        hashAnterior,
      }),
    );
    const hashAtual = createHash("sha256").update(logContent).digest("hex");

    // 4. Salvar o log com os hashes
    return await prisma.auditLog.create({
      data: {
        ...logData,
        hashAnterior,
        hashAtual
      }
    });
  }

  /**
   * Verifica a integridade da cadeia de auditoria.
   */
  async verifyIntegrity() {
    const prisma = getPrisma();
    const logs = await prisma.auditLog.findMany({
      orderBy: { id: "asc" }
    });

    let hashAnteriorEsperado = "GENESIS_HASH";
    const violations = [];

    for (const log of logs) {
      // Verificar se o hashAnterior bate
      if (log.hashAnterior !== hashAnteriorEsperado) {
        violations.push({ id: log.id, error: "Quebra na cadeia: hashAnterior inválido" });
      }

      // Recalcular o hashAtual e comparar
      const logData = {
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        before: log.before,
        after: log.after,
        ip: log.ip,
        userAgent: log.userAgent,
        createdAt: log.createdAt
      };
      
      const logContent = JSON.stringify(
        serializeForJson({
          ...logData,
          hashAnterior: log.hashAnterior,
        }),
      );
      const hashCalculado = createHash("sha256").update(logContent).digest("hex");

      if (log.hashAtual !== hashCalculado) {
        violations.push({ id: log.id, error: "Quebra na integridade: hashAtual modificado" });
      }

      hashAnteriorEsperado = log.hashAtual!;
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }
}
