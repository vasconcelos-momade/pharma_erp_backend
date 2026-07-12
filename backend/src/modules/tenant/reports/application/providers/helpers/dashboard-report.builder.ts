import { formatCurrency, toText } from "../../helpers/report-export.helper";
import { type ModuleReportDefinition, type ReportSectionTable } from "../types/report.types";

function formatDateTime(value: unknown): string {
  if (!value) {
    return "-";
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return toText(value);
  }
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function mapObjectTable(
  title: string,
  columns: string[],
  rows: Array<Record<string, unknown>>,
  getters: Array<(row: Record<string, unknown>) => unknown>,
): ReportSectionTable {
  return {
    title,
    columns,
    rows: rows.map((row) => getters.map((getter) => toText(getter(row)))),
  };
}

function periodFilters(periodo?: Record<string, unknown>) {
  return {
    Periodo: periodo?.label ?? periodo?.preset ?? "-",
    De: periodo?.from ?? "-",
    Ate: periodo?.to ?? "-",
    Dias: periodo?.days ?? "-",
  };
}

export function buildExecutiveDashboardReport(
  data: any,
): ModuleReportDefinition {
  const tables = data.tables ?? {};
  const periodo = data.periodo ?? {};

  return {
    fileBaseName: "dashboard-executivo",
    reportName: "Dashboard Executivo",
    title: "Dashboard Executivo",
    subtitle: "Indicadores consolidados de vendas, stock e financeiro",
    filters: periodFilters(periodo),
    kpis: Object.fromEntries(
      Object.entries(data.kpis ?? {}).map(([key, value]) => [
        key.replace(/([A-Z])/g, " $1").trim(),
        typeof value === "number" ? formatCurrency(value) : toText(value),
      ]),
    ),
    tables: [
      mapObjectTable(
        "Ultimas vendas",
        ["Fatura", "Cliente", "Total", "Estado", "Pagamento", "Data"],
        tables.ultimasVendas ?? [],
        [
          (row) => row.numero,
          (row) => row.clienteNome,
          (row) => formatCurrency(row.total),
          (row) => row.estado,
          (row) => row.tipoPagamento,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
      mapObjectTable(
        "Alertas criticos",
        ["Produto", "Tipo", "Mensagem", "Data"],
        tables.alertasCriticos ?? [],
        [
          (row) => row.produtoNomeComercial,
          (row) => row.tipo,
          (row) => row.mensagem,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
      mapObjectTable(
        "Ultimos eventos",
        ["Tipo", "Entidade", "Utilizador", "Data"],
        tables.ultimosEventos ?? [],
        [
          (row) => row.type,
          (row) => row.entity,
          (row) => row.userNome,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
      mapObjectTable(
        "Top produtos",
        ["Produto", "Quantidade", "Total"],
        data.charts?.topProdutos ?? [],
        [
          (row) => row.produtoNomeComercial,
          (row) => row.quantidade,
          (row) => formatCurrency(row.total),
        ],
      ),
    ],
    orientation: "landscape",
    pdf: { template: "dashboards/executive", orientation: "landscape", pageSize: "A4" },
  };
}

export function buildFinanceDashboardReport(data: any): ModuleReportDefinition {
  const tables = data.tables ?? {};
  const periodo = data.periodo ?? {};

  return {
    fileBaseName: "dashboard-financeiro",
    reportName: "Dashboard Financeiro",
    title: "Dashboard Financeiro",
    subtitle: "Fluxo de caixa, receitas, despesas e contas",
    filters: periodFilters(periodo),
    kpis: Object.fromEntries(
      Object.entries(data.kpis ?? {}).map(([key, value]) => [
        key.replace(/([A-Z])/g, " $1").trim(),
        typeof value === "number" ? formatCurrency(value) : toText(value),
      ]),
    ),
    tables: [
      mapObjectTable(
        "Ultimos pagamentos",
        ["Fatura", "Valor", "Metodo", "Estado", "Data"],
        tables.ultimosPagamentos ?? [],
        [
          (row) => row.faturaNumero,
          (row) => formatCurrency(row.valor),
          (row) => row.metodo,
          (row) => row.status,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
      mapObjectTable(
        "Ultimas receitas",
        ["Valor", "Tipo", "Referencia", "Data"],
        tables.ultimasReceitas ?? [],
        [
          (row) => formatCurrency(row.valor),
          (row) => row.tipo,
          (row) => row.referencia,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
      mapObjectTable(
        "Ultimas despesas",
        ["Valor", "Tipo", "Referencia", "Data"],
        tables.ultimasDespesas ?? [],
        [
          (row) => formatCurrency(row.valor),
          (row) => row.tipo,
          (row) => row.referencia,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
      mapObjectTable(
        "Contas vencidas",
        ["Cliente", "Valor", "Saldo", "Vencimento"],
        tables.contasVencidas ?? [],
        [
          (row) => row.clienteNome,
          (row) => formatCurrency(row.valor),
          (row) => formatCurrency(row.saldo),
          (row) => formatDateTime(row.vencimento),
        ],
      ),
    ],
    orientation: "landscape",
    pdf: { template: "dashboards/finance", orientation: "landscape", pageSize: "A4" },
  };
}

export function buildPharmacyDashboardReport(data: any): ModuleReportDefinition {
  const tables = data.tables ?? {};
  const periodo = data.periodo ?? {};

  return {
    fileBaseName: "dashboard-farmacia",
    reportName: "Dashboard Farmacia",
    title: "Dashboard Farmacia",
    subtitle: "Produtos, validades, dispensacoes e alertas sanitarios",
    filters: periodFilters(periodo),
    kpis: Object.fromEntries(
      Object.entries(data.kpis ?? {}).map(([key, value]) => [
        key.replace(/([A-Z])/g, " $1").trim(),
        typeof value === "number" ? formatCurrency(value) : toText(value),
      ]),
    ),
    tables: [
      mapObjectTable(
        "Produtos criticos",
        ["Produto", "Disponivel", "Minimo"],
        tables.produtosCriticos ?? [],
        [
          (row) => row.nomeComercial,
          (row) => row.disponivel,
          (row) => row.minimo,
        ],
      ),
      mapObjectTable(
        "Ultimas entradas",
        ["Produto", "Lote", "Quantidade", "Origem", "Data"],
        tables.ultimasEntradas ?? [],
        [
          (row) => row.produtoNomeComercial,
          (row) => row.numeroLote,
          (row) => row.quantidade,
          (row) => row.origem,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
      mapObjectTable(
        "Ultimas dispensacoes",
        ["Produto", "Lote", "Quantidade", "Tipo", "Data"],
        tables.ultimasDispensacoes ?? [],
        [
          (row) => row.produtoNomeComercial,
          (row) => row.numeroLote,
          (row) => row.quantidade,
          (row) => row.tipoDispensacao,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
      mapObjectTable(
        "Ultimos alertas",
        ["Produto", "Tipo", "Mensagem", "Data"],
        tables.ultimosAlertas ?? [],
        [
          (row) => row.produtoNomeComercial,
          (row) => row.tipo,
          (row) => row.mensagem,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
    ],
    orientation: "landscape",
    pdf: { template: "dashboards/pharmacy", orientation: "landscape", pageSize: "A4" },
  };
}

export function buildStockDashboardReport(data: any): ModuleReportDefinition {
  const tables = data.tables ?? {};
  const periodo = data.periodo ?? {};

  return {
    fileBaseName: "dashboard-stock",
    reportName: "Dashboard Stock",
    title: "Dashboard Stock & Logistica",
    subtitle: "Movimentos, inventários, compras e reservas",
    filters: periodFilters(periodo),
    kpis: Object.fromEntries(
      Object.entries(data.kpis ?? {}).map(([key, value]) => [
        key.replace(/([A-Z])/g, " $1").trim(),
        typeof value === "number" ? formatCurrency(value) : toText(value),
      ]),
    ),
    tables: [
      mapObjectTable(
        "Ultimos movimentos",
        ["Tipo", "Produto", "Lote", "Quantidade", "Origem", "Data"],
        tables.ultimosMovimentos ?? [],
        [
          (row) => row.tipo,
          (row) => row.produtoNomeComercial,
          (row) => row.numeroLote,
          (row) => row.quantidade,
          (row) => row.origem,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
      mapObjectTable(
        "Produtos criticos",
        ["Produto", "Disponivel", "Minimo"],
        tables.produtosCriticos ?? [],
        [
          (row) => row.nomeComercial,
          (row) => row.disponivel,
          (row) => row.minimo,
        ],
      ),
      mapObjectTable(
        "Inventarios",
        ["Codigo", "Estado", "Iniciado em"],
        tables.inventarios ?? [],
        [
          (row) => row.codigo,
          (row) => row.status,
          (row) => formatDateTime(row.iniciadoEm),
        ],
      ),
      mapObjectTable(
        "Entradas de compra",
        ["Produto", "Lote", "Fornecedor", "Quantidade", "Valor", "Data"],
        tables.entradasCompra ?? [],
        [
          (row) => row.produtoNomeComercial,
          (row) => row.numeroLote,
          (row) => row.fornecedorNome,
          (row) => row.quantidade,
          (row) => row.valorCompra,
          (row) => formatDateTime(row.createdAt),
        ],
      ),
    ],
    orientation: "landscape",
    pdf: { template: "dashboards/stock", orientation: "landscape", pageSize: "A4" },
  };
}
