import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";
import {
  persistProdutoRegulacao,
  prepareProdutoWrite,
  toProdutoRegulacaoTx,
} from "../src/modules/tenant/products/domain/produto-regulacao.persistence";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type MedicineClassification = {
  classificacao: "NORMAL" | "NARCOTICO" | "PSICOTROPICO_LIII" | "PSICOTROPICO_LIV" | "CONTROLADO_ESPECIAL";
  dispensacao: "VENDA_LIVRE" | "RECEITA_SIMPLES" | "RECEITA_CONTROLADA" | "RECEITA_OBRIGATORIA" | "PSICOTROPICO" | "NARCOTICO";
  requiresPrescription: boolean;
  requiresDoubleCheck: boolean;
  requiresPsychotropicBook: boolean;
  requiresManualReview: boolean;
  audit: ClassificationAudit;
  riskLevel: RiskLevel;
};

type ParsedMedicineRow = {
  empresa: string;
  nomeComercial: string;
  substancia: string;
  dosagem: string;
  forma: string;
  apresentacao: string;
  lineNumber: number;
  columns: string[];
};

type RuleGroupConfig = {
  categorias: string[];
  substancias: string[];
  nomesComerciais: string[];
  sinonimos: Record<string, string[]>;
};

type ClassificationRulesConfig = {
  narcoticos: RuleGroupConfig;
  psicotropicosLiii: RuleGroupConfig;
  psicotropicosLiv: RuleGroupConfig;
  controladosEspeciais: RuleGroupConfig;
  receitaSimples: RuleGroupConfig;
  otc: RuleGroupConfig;
};

type RuleGroup = {
  categorias: string[];
  substancias: string[];
  nomesComerciais: string[];
};

type ClassificationRules = {
  narcoticos: RuleGroup;
  psicotropicosLiii: RuleGroup;
  psicotropicosLiv: RuleGroup;
  controladosEspeciais: RuleGroup;
  receitaSimples: RuleGroup;
  otc: RuleGroup;
};

type ClassificationAudit = {
  rule: string;
  matchedField: "substancia" | "nomeComercial" | "fallback";
  matchedTerm: string | null;
  reason: string;
};

function normalize(text?: string | null): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeKeywordList(keywords: string[]): string[] {
  return Array.from(new Set(keywords.map((keyword) => normalize(keyword)).filter(Boolean)));
}

function expandKeywords(keywords: string[], sinonimos: Record<string, string[]>): string[] {
  const expandedKeywords = new Set<string>(normalizeKeywordList(keywords));

  for (const [canonical, aliases] of Object.entries(sinonimos)) {
    expandedKeywords.add(normalize(canonical));

    for (const alias of aliases) {
      expandedKeywords.add(normalize(alias));
    }
  }

  return Array.from(expandedKeywords);
}

function buildRuleGroup(config: RuleGroupConfig): RuleGroup {
  return {
    categorias: config.categorias,
    substancias: expandKeywords(config.substancias, config.sinonimos),
    nomesComerciais: expandKeywords(config.nomesComerciais, config.sinonimos),
  };
}

function loadClassificationRules(): ClassificationRules {
  const rulesPath = path.resolve(__dirname, "classificacao-medicamentos.json");

  if (!fs.existsSync(rulesPath)) {
    throw new Error(`Classification rules file not found at ${rulesPath}`);
  }

  const rawRules = JSON.parse(fs.readFileSync(rulesPath, "utf-8")) as ClassificationRulesConfig;

  return {
    narcoticos: buildRuleGroup(rawRules.narcoticos),
    psicotropicosLiii: buildRuleGroup(rawRules.psicotropicosLiii),
    psicotropicosLiv: buildRuleGroup(rawRules.psicotropicosLiv),
    controladosEspeciais: buildRuleGroup(rawRules.controladosEspeciais),
    receitaSimples: buildRuleGroup(rawRules.receitaSimples),
    otc: buildRuleGroup(rawRules.otc),
  };
}

const classificationRules = loadClassificationRules();

const ANTIMICROBIAL_HINTS = [
  "AMOXICIL",
  "AMPICIL",
  "CIPROFLOX",
  "METRONIDAZ",
  "AZITHROM",
  "CLARITHROM",
  "CEFTRIAX",
  "DOXYCICL",
  "TRIMETHOPRIM",
  "NITROFUR",
  "PENICIL",
  "CLINDAMIC",
  "ERYTHROM",
  "FLUCONAZ",
  "ACICLOVIR",
  "ANTIBIOT",
];

function inferFnmCodigo(substancia: string, nomeComercial: string): string {
  const text = normalize(`${substancia} ${nomeComercial}`);
  return ANTIMICROBIAL_HINTS.some((hint) => text.includes(hint))
    ? "ANTIMICROBIANOS"
    : "SISTEMA_NERVOSO_CENTRAL";
}

function truncateField(text?: string | null, maxLength = 191): string {
  return (text ?? "").trim().substring(0, maxLength);
}

function toNullable(text?: string | null): string | null {
  const sanitized = (text ?? "").trim();
  return sanitized === "" ? null : sanitized;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      currentRow.push(currentField);
      currentField = "";

      if (char === "\r" && nextChar === "\n") {
        i++;
      }

      rows.push(currentRow);
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows
    .map((row) => row.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim()))
    .filter((row) => row.some((value) => value !== ""));
}

function buildProductKey(nome: string, dosagem?: string | null, forma?: string | null, apresentacao?: string | null): string {
  return [
    normalize(nome),
    normalize(dosagem),
    normalize(forma),
    normalize(apresentacao),
  ].join("::");
}

function generatePrecoVenda(substancia: string, dosagem: string, forma: string): number {
  const sub = normalize(substancia);
  const form = normalize(forma);
  
  let basePrice = 50;
  
  if (sub.includes("INSULINA") || sub.includes("OXITOCINA") || sub.includes("CARBAMAZEPINA")) {
    basePrice = 500;
  } else if (sub.includes("ANTIBIOTICO") || form.includes("INJETAVEL") || form.includes("AMPOLA")) {
    basePrice = 200;
  } else if (form.includes("CREME") || form.includes("GEL") || form.includes("POMADA")) {
    basePrice = 150;
  } else if (form.includes("SUSPENSAO") || form.includes("XAROPE")) {
    basePrice = 120;
  } else if (form.includes("COMPRIMIDO") || form.includes("CAPSULA")) {
    basePrice = 80;
  }
  
  const variation = Math.random() * 0.4 - 0.2;
  const price = basePrice * (1 + variation);
  
  return Math.round(price * 100) / 100;
}

function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function findMatchingKeyword(text: string, keywords: string[]): string | null {
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}


function isCombinationDrug(substancia: string): boolean {
  return substancia.includes("+");
}

function detectHighRiskCombination(substancia: string): boolean {
  const sub = normalize(substancia);

  const dangerousGroups = [
    "PARACETAMOL",
    "ACIDO ACETILSALICILICO",
    "DEXTROMETORFANO",
    "FENILPROPANOLAMINA",
    "ALCOOL"
  ];

  const matches = dangerousGroups.filter((x) => sub.includes(x));

  return matches.length >= 2;
}

function computeRiskLevel(dispensacao: string, substancia: string): RiskLevel {
  const sub = normalize(substancia);

  if (sub.includes("INSULINA") || sub.includes("OXITOCINA")) return "CRITICAL";

  if (
    sub.includes("CARBAMAZEPINA") ||
    sub.includes("ARTESUNATO") ||
    sub.includes("AMODIAQUINA")
  ) return "HIGH";

  if (detectHighRiskCombination(substancia)) return "HIGH";

  if (dispensacao === "RECEITA_CONTROLADA") return "HIGH";

  if (dispensacao === "RECEITA_SIMPLES") return "MEDIUM";

  return "LOW";
}

function canBeOTC(substancia: string, nome: string): boolean {
  const sub = normalize(substancia);
  const nm = normalize(nome);

  const otcAllowed = classificationRules.otc.substancias;

  const isSimpleOTC =
    otcAllowed.some((k) => sub.includes(k)) ||
    otcAllowed.some((k) => nm.includes(k));

  if (isCombinationDrug(substancia)) return false;

  const forbidden = [
    "ANTIBIOTICO",
    "HORMONIO",
    "INSULINA",
    "ARTESUNATO",
    "OFLOXACINA"
  ];

  if (forbidden.some((f) => sub.includes(f))) return false;

  return isSimpleOTC;
}

function classifyMedicine(nomeComercial: string, substancia: string): MedicineClassification {
  const nome = normalize(nomeComercial);
  const sub = normalize(substancia);

  const narcoticoMatch = findMatchingKeyword(sub, classificationRules.narcoticos.substancias);
  if (narcoticoMatch) {
    return {
      classificacao: "NARCOTICO",
      dispensacao: "NARCOTICO",
      requiresPrescription: true,
      requiresDoubleCheck: true,
      requiresPsychotropicBook: true,
      requiresManualReview: false,
      riskLevel: computeRiskLevel("NARCOTICO", substancia),
      audit: {
        rule: "narcoticos",
        matchedField: "substancia",
        matchedTerm: narcoticoMatch,
        reason: `Classificado como NARCOTICO por correspondencia na substancia: ${narcoticoMatch}`,
      },
    };
  }

  const psicotropicoLiiiMatch = findMatchingKeyword(sub, classificationRules.psicotropicosLiii.substancias);
  if (psicotropicoLiiiMatch) {
    return {
      classificacao: "PSICOTROPICO_LIII",
      dispensacao: "PSICOTROPICO",
      requiresPrescription: true,
      requiresDoubleCheck: true,
      requiresPsychotropicBook: true,
      requiresManualReview: false,
      riskLevel: computeRiskLevel("PSICOTROPICO", substancia),
      audit: {
        rule: "psicotropicosLIII",
        matchedField: "substancia",
        matchedTerm: psicotropicoLiiiMatch,
        reason: `Classificado como PSICOTROPICO_LIII por correspondencia na substancia: ${psicotropicoLiiiMatch}`,
      },
    };
  }

  const psicotropicoLivMatch = findMatchingKeyword(sub, classificationRules.psicotropicosLiv.substancias);
  if (psicotropicoLivMatch) {
    return {
      classificacao: "PSICOTROPICO_LIV",
      dispensacao: "PSICOTROPICO",
      requiresPrescription: true,
      requiresDoubleCheck: true,
      requiresPsychotropicBook: true,
      requiresManualReview: false,
      riskLevel: computeRiskLevel("PSICOTROPICO", substancia),
      audit: {
        rule: "psicotropicosLIV",
        matchedField: "substancia",
        matchedTerm: psicotropicoLivMatch,
        reason: `Classificado como PSICOTROPICO_LIV por correspondencia na substancia: ${psicotropicoLivMatch}`,
      },
    };
  }

  const controladoEspecialSubMatch = findMatchingKeyword(sub, classificationRules.controladosEspeciais.substancias);
  const controladoEspecialNomeMatch = findMatchingKeyword(nome, classificationRules.controladosEspeciais.nomesComerciais);
  if (controladoEspecialSubMatch || controladoEspecialNomeMatch) {
    const matchedField = controladoEspecialSubMatch ? "substancia" : "nomeComercial";
    const matchedTerm = controladoEspecialSubMatch ?? controladoEspecialNomeMatch;

    return {
      classificacao: "CONTROLADO_ESPECIAL",
      dispensacao: "RECEITA_CONTROLADA",
      requiresPrescription: true,
      requiresDoubleCheck: true,
      requiresPsychotropicBook: false,
      requiresManualReview: false,
      riskLevel: computeRiskLevel("RECEITA_CONTROLADA", substancia),
      audit: {
        rule: "controlados",
        matchedField,
        matchedTerm,
        reason: `Classificado como CONTROLADO_ESPECIAL por correspondencia no ${matchedField}: ${matchedTerm}`,
      },
    };
  }

  const receitaSimplesMatch = findMatchingKeyword(sub, classificationRules.receitaSimples.substancias);
  if (receitaSimplesMatch) {
    return {
      classificacao: "NORMAL",
      dispensacao: "RECEITA_SIMPLES",
      requiresPrescription: true,
      requiresDoubleCheck: false,
      requiresPsychotropicBook: false,
      requiresManualReview: false,
      riskLevel: computeRiskLevel("RECEITA_SIMPLES", substancia),
      audit: {
        rule: "receitaSimples",
        matchedField: "substancia",
        matchedTerm: receitaSimplesMatch,
        reason: `Classificado como RECEITA_SIMPLES por correspondencia na substancia: ${receitaSimplesMatch}`,
      },
    };
  }

  if (canBeOTC(substancia, nomeComercial)) {
    const otcSubMatch = findMatchingKeyword(sub, classificationRules.otc.substancias);
    const otcNomeMatch = findMatchingKeyword(nome, classificationRules.otc.nomesComerciais);
    const matchedField = otcSubMatch ? "substancia" : "nomeComercial";
    const matchedTerm = otcSubMatch ?? otcNomeMatch;

    return {
      classificacao: "NORMAL",
      dispensacao: "VENDA_LIVRE",
      requiresPrescription: false,
      requiresDoubleCheck: false,
      requiresPsychotropicBook: false,
      requiresManualReview: false,
      riskLevel: computeRiskLevel("VENDA_LIVRE", substancia),
      audit: {
        rule: "otc",
        matchedField,
        matchedTerm,
        reason: `Classificado como VENDA_LIVRE por regra OTC no ${matchedField}: ${matchedTerm}`,
      },
    };
  }

  return {
    classificacao: "NORMAL",
    dispensacao: "RECEITA_SIMPLES",
    requiresPrescription: true,
    requiresDoubleCheck: false,
    requiresPsychotropicBook: false,
    requiresManualReview: true,
    riskLevel: computeRiskLevel("RECEITA_SIMPLES", substancia),
    audit: {
      rule: "fallbackSafe",
      matchedField: "fallback",
      matchedTerm: null,
      reason: "Fallback seguro para revisão manual",
    },
  };
}

async function main() {
  const csvPath = path.resolve(__dirname, "../BD_Medicamentos.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const taxRule = await prisma.taxRule.findFirst({
    where: { codigo: "IVA_ISENTO_MEDICAMENTOS" },
  });

  if (!taxRule) {
    throw new Error("IVA_ISENTO_MEDICAMENTOS tax rule not found");
  }

  const fnmCategorias = await prisma.categoria.findMany({
    where: { codigoFNM: { not: null }, deletedAt: null },
    select: { id: true, nome: true, codigoFNM: true },
  });
  const categoriaByCodigo = new Map(
    fnmCategorias.map((c) => [String(c.codigoFNM), c]),
  );

  if (categoriaByCodigo.size === 0) {
    throw new Error(
      "Categorias FNM não encontradas. Execute seed-fnm-categorias ou a migration FNM primeiro.",
    );
  }

  console.log(`Using tax rule: ${taxRule.codigo} (ID: ${taxRule.id})`);
  console.log(`Categorias FNM disponíveis: ${categoriaByCodigo.size}`);

  const content = fs.readFileSync(csvPath, "utf-8");
  const parsedCsv = parseCsv(content);
  const rows: ParsedMedicineRow[] = parsedCsv.slice(1).map((columns, index) => {
    const [
      empresa = "",
      nomeComercial = "",
      substancia = "",
      dosagem = "",
      forma = "",
      apresentacao = "",
    ] = columns;

    return {
      empresa,
      nomeComercial,
      substancia,
      dosagem,
      forma,
      apresentacao,
      lineNumber: index + 2,
      columns,
    };
  });

  console.log(`🚀 Iniciando seed de ${rows.length} medicamentos do ficheiro BD_Medicamentos.csv...`);

  const fornecedoresCache = new Map<string, bigint>();
  const produtosCache = new Map<string, bigint>();
  const duplicateProductKeys = new Set<string>();
  const classificationSummary = new Map<string, { count: number; reason: string }>();

  const produtosExistentes = await prisma.produto.findMany({
    select: {
      id: true,
      nomeComercial: true,
      dosagem: true,
      forma: true,
      apresentacao: true,
    },
  });

  for (const produto of produtosExistentes) {
    const productKey = buildProductKey(
      produto.nomeComercial,
      produto.dosagem,
      produto.forma,
      produto.apresentacao,
    );

    if (produtosCache.has(productKey)) {
      duplicateProductKeys.add(productKey);
      continue;
    }

    produtosCache.set(productKey, produto.id);
  }

  if (duplicateProductKeys.size > 0) {
    console.warn(
      `⚠️ Foram detectados ${duplicateProductKeys.size} produtos existentes com chave natural duplicada. ` +
        "O seed atualizará apenas o primeiro registo encontrado para cada chave.",
    );
  }

  let count = 0;
  let antimicrobianosCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { empresa, nomeComercial, substancia, dosagem, forma, apresentacao } = row;

    if (!nomeComercial) continue;

    const safeNome = truncateField(nomeComercial);
    const safeSubstancia = truncateField(substancia);
    const safeDosagem = truncateField(dosagem);
    const safeForma = truncateField(forma);
    const safeApresentacao = truncateField(apresentacao);

    const {
      dispensacao,
      requiresPrescription,
      requiresDoubleCheck,
      requiresPsychotropicBook,
      requiresManualReview,
      audit,
      riskLevel,
    } = classifyMedicine(safeNome, safeSubstancia);

    const fnmCodigo = inferFnmCodigo(safeSubstancia, safeNome);
    const categoriaFnm = categoriaByCodigo.get(fnmCodigo);
    if (!categoriaFnm) {
      throw new Error(`Categoria FNM ${fnmCodigo} não encontrada`);
    }
    if (fnmCodigo === "ANTIMICROBIANOS") {
      antimicrobianosCount++;
    }

    try {
      const fornecedorNome = truncateField(empresa || "Fornecedor Geral", 255);
      let fornecedorId = fornecedoresCache.get(fornecedorNome);

      if (!fornecedorId) {
        const fornecedor = await prisma.fornecedor.upsert({
          where: { nome: fornecedorNome },
          update: {
            tipo: "IMPORTADOR"
          },
          create: {
            nome: fornecedorNome,
            ativo: true,
            tipo: "IMPORTADOR"
          }
        });

        fornecedorId = fornecedor.id;
        fornecedoresCache.set(fornecedorNome, fornecedor.id);
      }

      const productKey = buildProductKey(
        safeNome,
        safeDosagem,
        safeForma,
        safeApresentacao,
      );

      const precoVenda = generatePrecoVenda(safeSubstancia, safeDosagem, safeForma);
      
      const produtoPayload = {
        nomeComercial: safeNome,
        nomeGenerico: toNullable(safeSubstancia),
        dosagem: toNullable(safeDosagem),
        forma: toNullable(safeForma),
        apresentacao: toNullable(safeApresentacao),
        tipoDispensacao: dispensacao as any,
        requiresPrescription,
        requiresDoubleCheck,
        requiresPsychotropicBook,
        requiresManualReview,
        classificacaoRule: truncateField(audit.rule, 100),
        classificacaoReason: audit.reason,
        classificacaoMatchedTerm: toNullable(truncateField(audit.matchedTerm, 191)),
        taxRuleId: taxRule.id,
        categoriaId: categoriaFnm.id,
        riskLevel: riskLevel as any,
      };

      const { catalogData, policy } = prepareProdutoWrite(
        produtoPayload as Record<string, unknown>,
        "seed:anarme",
        null,
        categoriaFnm,
      );

      let produtoId = produtosCache.get(productKey);

      if (produtoId) {
        await prisma.$transaction(async (tx) => {
          await tx.produto.update({
            where: { id: produtoId },
            data: catalogData as any,
          });
          await persistProdutoRegulacao(
            toProdutoRegulacaoTx(tx),
            produtoId!,
            policy,
            "seed:anarme",
          );
        });
      } else {
        const createdId = await prisma.$transaction(async (tx) => {
          const produto = await tx.produto.create({
            data: {
              ...catalogData,
              estoqueMinimo: 10,
            } as any,
          });
          await persistProdutoRegulacao(
            toProdutoRegulacaoTx(tx),
            produto.id,
            policy,
            "seed:anarme",
          );
          return produto.id;
        });

        produtoId = createdId;
        produtosCache.set(productKey, createdId);
      }

      const precoCompra = Math.round(precoVenda * 0.65 * 100) / 100;
      
      await prisma.produtoFornecedor.upsert({
        where: {
          produtoId_fornecedorId: {
            produtoId,
            fornecedorId,
          }
        },
        update: {
          precoCompra,
        },
        create: {
          produtoId,
          fornecedorId,
          precoCompra,
          fornecedorPrincipal: true
        }
      });

      count++;
      const summaryEntry = classificationSummary.get(audit.rule);
      if (summaryEntry) {
        summaryEntry.count += 1;
      } else {
        classificationSummary.set(audit.rule, {
          count: 1,
          reason: audit.reason,
        });
      }

      if (count % 100 === 0) console.log(`✅ Processados ${count} medicamentos...`);
    } catch (err) {
      console.error(`❌ Erro no item ${row.lineNumber} (${nomeComercial}):`, {
        row: row.columns,
        classificationAudit: audit,
        err,
      });
    }
  }

  if (classificationSummary.size > 0) {
    console.log("\n📋 Resumo de classificacao:");
    for (const [rule, summary] of classificationSummary.entries()) {
      console.log(`- ${rule}: ${summary.count} registos. Exemplo: ${summary.reason}`);
    }
  }

  console.log(`🦠 Produtos na categoria FNM ANTMIICROBIANOS: ${antimicrobianosCount}`);

  console.log(`\n🎉 Seed concluído! ${count} produtos e seus respectivos fornecedores foram importados a partir de BD_Medicamentos.csv.`);
}

main().finally(async () => {
    await prisma.$disconnect();
  });
