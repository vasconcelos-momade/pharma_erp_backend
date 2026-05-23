export interface TaxRuleSnapshot {
  tipo: "IVA_NORMAL" | "IVA_REDUZIDO" | "IVA_ISENTO" | "NAO_TRIBUTAVEL";
  taxa: number; // ex: 0.16 para 16%
  codigo: string;
  descricao?: string;
}

export interface FiscalItemInput {
  quantidade: number;
  precoUnitario: number;
  taxRule?: TaxRuleSnapshot | null;
  descricao: string;
}

export interface FiscalCalculationResult {
  baseCalculo: number;
  taxaAplicada: number; // em decimal (0.16)
  taxaAplicadaPercentual: number; // em percentual (16)
  valorIva: number;
  totalItem: number;
  tipoRegraFiscal?: string;
  codigoRegraFiscal?: string;
  motivoIsencao?: string;
  moedaTaxa: string;
}

export class FiscalCalculatorUtil {
  private static readonly DEFAULT_MOEDA = "MZN";
  private static readonly DEFAULT_TAXA_NORMAL = 0.16; // 16% padrão para Moçambique

  static calcularIVA(input: FiscalItemInput): FiscalCalculationResult {
    const { quantidade, precoUnitario, taxRule, descricao } = input;

    const baseCalculo = quantidade * precoUnitario;
    let taxaAplicada = 0;
    let valorIva = 0;
    let tipoRegraFiscal = taxRule?.tipo;
    let codigoRegraFiscal = taxRule?.codigo;
    let motivoIsencao: string | undefined;

    if (!taxRule || taxRule.tipo === "IVA_ISENTO" || taxRule.tipo === "NAO_TRIBUTAVEL") {
      taxaAplicada = 0;
      valorIva = 0;
      if (taxRule?.tipo === "IVA_ISENTO") {
        motivoIsencao = "Produto/serviço isento de IVA (medicamento essencial)";
      }
      if (taxRule?.tipo === "NAO_TRIBUTAVEL") {
        motivoIsencao = "Serviço não tributável por lei";
      }
    } else {
      taxaAplicada = this.normalizeTaxRate(taxRule.taxa);
      valorIva = baseCalculo * taxaAplicada;
    }

    const totalItem = baseCalculo + valorIva;

    return {
      baseCalculo,
      taxaAplicada,
      taxaAplicadaPercentual: taxaAplicada * 100,
      valorIva,
      totalItem,
      tipoRegraFiscal,
      codigoRegraFiscal,
      motivoIsencao,
      moedaTaxa: this.DEFAULT_MOEDA,
    };
  }

  /** Aceita taxa em percentual (16) ou decimal (0.16). */
  static normalizeTaxRate(taxa: number): number {
    if (!Number.isFinite(taxa) || taxa <= 0) {
      return 0;
    }
    return taxa > 1 ? taxa / 100 : taxa;
  }

  static calcularFaturaTotal(itens: FiscalCalculationResult[]) {
    const subtotal = itens.reduce((acc, item) => acc + item.baseCalculo, 0);
    const ivaTotal = itens.reduce((acc, item) => acc + item.valorIva, 0);
    const total = subtotal + ivaTotal;

    return {
      subtotal,
      ivaTotal,
      total,
    };
  }
}
