import { getPrisma } from "../../infrastructure/prisma/tenant-prisma.factory";

export interface ComplianceRuleResult {
  passed: boolean;
  message?: string;
  errorCode?: string;
}

export class ComplianceEngineService {
  /**
   * Valida regras da ANARME e boas práticas farmacêuticas para uma venda.
   */
  async validateVenda(data: {
    produto: any;
    quantidade: number;
    receitaId?: bigint | null;
    validatorUserId?: string | null;
  }): Promise<ComplianceRuleResult> {
    const { produto, receitaId, validatorUserId } = data;

    // 1. Regra: Medicamento Controlado exige Receita
    if (Boolean(produto.requiresPrescription) && !receitaId) {
      return {
        passed: false,
        message: `O produto ${produto.nomeComercial} exige prescrição médica obrigatória.`,
        errorCode: "MISSING_PRESCRIPTION"
      };
    }

    // 2. Regra: Receita especial exige dupla validação (Diretor Técnico/Farmacêutico)
    if (
      produto.tipoDispensacao === "RECEITA_ESPECIAL" &&
      Boolean(produto.requiresDoubleCheck) &&
      !validatorUserId
    ) {
        return {
          passed: false,
          message: `O produto ${produto.nomeComercial} (receita especial) exige validação de um segundo profissional qualificado.`,
          errorCode: "MISSING_DOUBLE_CHECK"
        };
    }

    // 3. Regra: Receita especial deve registar no Livro de Psicotrópicos
    if (produto.tipoDispensacao === "RECEITA_ESPECIAL" && !produto.requiresPsychotropicBook) {
        return {
            passed: false,
            message: `Configuração inconsistente: Receita especial ${produto.nomeComercial} deve obrigatoriamente registar no Livro de Psicotrópicos.`,
            errorCode: "INCONSISTENT_CONFIG"
        };
    }

    return { passed: true };
  }

  /**
   * Verifica se um lote está apto para venda comercial.
   */
  async validateLoteDisponibilidade(lote: any): Promise<ComplianceRuleResult> {
      if (lote.estadoSanitario !== 'VALIDO') {
          return {
              passed: false,
              message: `Lote ${lote.numeroLote} bloqueado sanitariamente: ${lote.estadoSanitario}`,
              errorCode: "SANITARY_BLOCK"
          };
      }

      if (lote.disponibilidade !== 'DISPONIVEL') {
          return {
              passed: false,
              message: `Lote ${lote.numeroLote} indisponível para venda: ${lote.disponibilidade}`,
              errorCode: "COMMERCIAL_BLOCK"
          };
      }

      const hoje = new Date();
      if (new Date(lote.dataValidade) <= hoje) {
          return {
              passed: false,
              message: `Lote ${lote.numeroLote} expirado.`,
              errorCode: "EXPIRED_LOT"
          };
      }

      return { passed: true };
  }
}
